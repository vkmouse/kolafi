"""
CLEANUP Worker：由 worker_framework 驅動執行，負責兩件事：

1. 刪除每個素材在物件儲存中的原始檔與縮圖兩個 key。
   批次型任務：一次 Pull 拿到一批待清理素材，每筆素材的成敗互相獨立，最終以成功/失敗清單回報，
   Ack 一律回 SUCCESS（跟 CAPTION/EXPORT/TAG/DOWNLOAD 那種單一結果型任務不同）。

2. 清理 R2 裡前端碰不到的舊匯出檔（exports/ 底下）。
   API 在 Pull 時已先把 DB 裡每個 (project_id, user_id) 的舊匯出列刪掉，只保留最新一筆，
   並把剩下的匯出清單放在 payload.exports.keep。這裡列出 R2 exports/ 的所有物件，
   凡是不在保留清單內的都刪除。這是「R2 清單 vs 目前 DB」的無狀態比對，失敗了下次清理會自動補上。
"""
import os
import re
from datetime import datetime, timedelta, timezone

from logger import get_logger
from task_api_client import TaskApiClient, TaskApiError
from worker_framework import WorkerFramework

import s3_client

logger = get_logger('cleanup-worker')

TASK_TYPE = 'cleanup'

# 只認 EXPORT worker 實際會產生的 key 格式；exports/ 底下任何不符合這個格式的物件一律不刪，只記 log
EXPORT_KEY_RE = re.compile(r'^exports/[^/]+/export_[^/]+\.mp4$')

# payload 沒帶 graceSeconds 時的保底值（正常情況 API 一定會帶，目前是 3600 秒）
DEFAULT_EXPORT_GRACE_SECONDS = 3600

# 一次清理最多刪幾個匯出檔；超過就整批不刪。用來擋「保留清單異常地少」造成的大量誤刪，
# 正常情況每次只會有少數幾個舊匯出，遠低於這個值。
MAX_EXPORT_DELETE_PER_RUN = int(os.environ.get('CLEANUP_EXPORTS_MAX_DELETE', '100'))


def _delete_key(key: str) -> bool:
    """刪單一 key，成功（含本來就不存在）回傳 True，失敗回傳 False。"""
    try:
        s3_client.delete_object(key)
        return True
    except Exception as e:
        logger.warning("刪除 %s 失敗: %s", key, e)
        return False


def _process_single_asset(asset: dict) -> bool:
    """兩個 key 都要各自嘗試刪除，不能其中一個失敗就跳過另一個；
    只要其中任一個非 404 錯誤，這個素材就整體視為失敗。"""
    asset_id = asset['id']
    extension = asset['extension']
    source_id = asset['sourceId']

    asset_object_key = s3_client.asset_key(source_id, asset_id, extension)
    thumb_object_key = s3_client.thumbnail_key(source_id, asset_id)

    asset_ok = _delete_key(asset_object_key)
    thumb_ok = _delete_key(thumb_object_key)

    return asset_ok and thumb_ok


def _cleanup_exports(exports: dict | None) -> tuple[list[str], list[str]]:
    """刪除 R2 exports/ 底下不在保留清單內的匯出檔，回傳 (已刪除的 key, 刪除失敗的 key)。

    不刪除的情況：
    - payload 沒有 exports.keep：視為 API 還沒更新，整段略過。絕對不能把「沒帶」當成「保留清單是空的」，
      否則新舊版本錯開部署時會把整個 exports/ 清空。
    - key 格式不是 exports/{project_id}/export_{id}.mp4：只記 log。
    - LastModified 在寬限期內：可能是剛上傳完、EXPORT ack 還沒把 DB 列寫進去的新匯出。
    - 要刪的數量超過 MAX_EXPORT_DELETE_PER_RUN：整批不刪，視為保留清單異常。

    保留清單建構與 R2 列舉都在任何刪除之前完成；任何一步拋例外都會在刪除前中止，由呼叫端處理。
    """
    if not isinstance(exports, dict) or not isinstance(exports.get('keep'), list):
        logger.info("payload 沒有 exports 保留清單，略過匯出檔清理")
        return [], []

    # 任何一筆格式不對（KeyError）都讓整段中止，不能拿一份殘缺的保留清單去刪檔
    keep_keys = {s3_client.export_key(ref['projectId'], ref['exportId']) for ref in exports['keep']}

    grace_seconds = int(exports.get('graceSeconds', DEFAULT_EXPORT_GRACE_SECONDS))
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=grace_seconds)

    candidates = []
    skipped_recent = 0
    for key, last_modified in s3_client.list_objects('exports/'):
        if not EXPORT_KEY_RE.match(key):
            logger.warning("exports/ 底下有非預期格式的 key，不處理: %s", key)
            continue
        if key in keep_keys:
            continue
        if last_modified > cutoff:
            skipped_recent += 1
            logger.info("匯出檔 %s 不在 DB 但還在寬限期內（%s），先不刪", key, last_modified.isoformat())
            continue
        candidates.append(key)

    logger.info("匯出檔清理：保留清單 %d 筆，待刪 %d 個，寬限期內略過 %d 個",
                len(keep_keys), len(candidates), skipped_recent)

    if len(candidates) > MAX_EXPORT_DELETE_PER_RUN:
        logger.error("待刪匯出檔 %d 個，超過單次上限 %d，整批不刪（請確認保留清單是否正確，必要時調高 CLEANUP_EXPORTS_MAX_DELETE）",
                     len(candidates), MAX_EXPORT_DELETE_PER_RUN)
        return [], []

    deleted, failed = [], []
    for key in candidates:
        logger.info("刪除舊匯出檔 %s", key)
        (deleted if _delete_key(key) else failed).append(key)
    return deleted, failed


def process_task(task_data: dict, client: TaskApiClient) -> None:
    """每個素材的成敗都在 _process_single_asset 內部吞掉並分流到成功/失敗清單，
    確保這個迴圈本身一定跑得完，最終一律回報 SUCCESS。"""
    task_id = task_data['taskId']
    assets = task_data.get('payload', {}).get('assets', [])

    logger.info("[task %s] 開始處理，待清理素材數：%d", task_id, len(assets))

    cleaned_ids = []
    failed_ids = []

    for idx, asset in enumerate(assets, 1):
        asset_id = asset.get('id')
        logger.info("[task %s] (%d/%d) 清理素材 %s", task_id, idx, len(assets), asset_id)
        try:
            ok = _process_single_asset(asset)
        except Exception as e:
            # 保底：_process_single_asset 理論上不會拋到這裡
            logger.exception("[task %s] 素材 %s 處理時發生未預期例外: %s", task_id, asset_id, e)
            ok = False

        (cleaned_ids if ok else failed_ids).append(asset_id)

    logger.info("[task %s] 處理完成：成功 %d、失敗 %d", task_id, len(cleaned_ids), len(failed_ids))

    # 匯出檔清理獨立於素材清理：任何例外都只記 log，不能影響素材結果的 Ack
    deleted_export_keys, failed_export_keys = [], []
    try:
        deleted_export_keys, failed_export_keys = _cleanup_exports(task_data.get('payload', {}).get('exports'))
    except Exception as e:
        logger.exception("[task %s] 匯出檔清理中止（沒有刪除任何東西，下次清理會重試）: %s", task_id, e)

    logger.info("[task %s] 匯出檔清理：刪除 %d、失敗 %d", task_id, len(deleted_export_keys), len(failed_export_keys))

    try:
        client.ack(task_id, {
            'status': 'SUCCESS',
            'cleanedAssetIds': cleaned_ids,
            'failedAssetIds': failed_ids,
            'deletedExportKeys': deleted_export_keys,
            'failedExportKeys': failed_export_keys,
        })
    except TaskApiError as e:
        # Ack 失敗會讓任務卡在 PROCESSING，但下一次全域掃描 Pull 會自動補上
        logger.error("[task %s] Ack 送出失敗: %s", task_id, e)


def main():
    WorkerFramework(TASK_TYPE, process_task).run()


if __name__ == '__main__':
    main()
