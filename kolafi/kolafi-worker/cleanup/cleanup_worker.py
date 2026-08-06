"""
CLEANUP Worker：刪除每個素材在物件儲存中的原始檔與縮圖兩個 key，由 worker_framework 驅動執行。

批次型任務：一次 Pull 拿到一批待清理素材，每筆素材的成敗互相獨立，最終以成功/失敗清單回報，
Ack 一律回 SUCCESS（跟 CAPTION/EXPORT/TAG/DOWNLOAD 那種單一結果型任務不同）。
"""
from logger import get_logger
from task_api_client import TaskApiClient, TaskApiError
from worker_framework import WorkerFramework

import s3_client

logger = get_logger('cleanup-worker')

TASK_TYPE = 'cleanup'


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

    try:
        client.ack(task_id, {
            'status': 'SUCCESS',
            'cleanedAssetIds': cleaned_ids,
            'failedAssetIds': failed_ids,
        })
    except TaskApiError as e:
        # Ack 失敗會讓任務卡在 PROCESSING，但下一次全域掃描 Pull 會自動補上
        logger.error("[task %s] Ack 送出失敗: %s", task_id, e)


def main():
    WorkerFramework(TASK_TYPE, process_task).run()


if __name__ == '__main__':
    main()
