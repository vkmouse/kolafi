"""
THUMBNAIL Worker：下載原始檔 → 產生縮圖 → 上傳，由 worker_framework 驅動執行。

批次型任務：一次 Pull 拿到一批待處理素材，每筆素材的成敗互相獨立，最終以成功/失敗清單回報，
Ack 一律回 SUCCESS（跟 CAPTION/EXPORT/TAG/DOWNLOAD 那種單一結果型任務不同）。
"""
import os
import tempfile

from logger import get_logger
from task_api_client import TaskApiClient, TaskApiError
from worker_framework import WorkerFramework

import s3_client
import thumbnail_generator

logger = get_logger('thumbnail-worker')

TASK_TYPE = 'thumbnail'


def _process_single_asset(asset: dict) -> bool:
    """下載原始檔 → 產生縮圖 → 上傳。任一步失敗回傳 False，成功回傳 True。"""
    asset_id = asset['id']
    extension = asset['extension']
    asset_type = asset['type']
    source_id = asset['sourceId']

    asset_object_key = s3_client.asset_key(source_id, asset_id, extension)
    thumb_object_key = s3_client.thumbnail_key(source_id, asset_id)

    with tempfile.TemporaryDirectory() as tmpdir:
        src_path = os.path.join(tmpdir, f"{asset_id}{extension}")
        dst_path = os.path.join(tmpdir, f"{asset_id}.jpg")

        try:
            found = s3_client.download_to_file(asset_object_key, src_path)
        except Exception as e:
            logger.warning("素材 %s 下載原始檔失敗: %s", asset_id, e)
            return False

        if not found:
            logger.warning("素材 %s 找不到原始檔: %s", asset_id, asset_object_key)
            return False

        try:
            thumbnail_generator.generate_thumbnail(asset_type, src_path, dst_path)
        except thumbnail_generator.ThumbnailGenerationError as e:
            logger.warning("素材 %s 產生縮圖失敗: %s", asset_id, e)
            return False

        try:
            s3_client.upload_file(dst_path, thumb_object_key)
        except Exception as e:
            logger.warning("素材 %s 上傳縮圖失敗: %s", asset_id, e)
            return False

    return True


def process_task(task_data: dict, client: TaskApiClient) -> None:
    """每個素材的成敗都在 _process_single_asset 內部吞掉並分流到成功/失敗清單，
    確保這個迴圈本身一定跑得完，最終一律回報 SUCCESS。"""
    task_id = task_data['taskId']
    assets = task_data.get('payload', {}).get('assets', [])

    logger.info("[task %s] 開始處理，待處理素材數：%d", task_id, len(assets))

    success_ids = []
    failed_ids = []

    for idx, asset in enumerate(assets, 1):
        asset_id = asset.get('id')
        logger.info("[task %s] (%d/%d) 處理素材 %s", task_id, idx, len(assets), asset_id)
        try:
            ok = _process_single_asset(asset)
        except Exception as e:
            # 保底：_process_single_asset 理論上不會拋到這裡
            logger.exception("[task %s] 素材 %s 處理時發生未預期例外: %s", task_id, asset_id, e)
            ok = False

        (success_ids if ok else failed_ids).append(asset_id)

    logger.info("[task %s] 處理完成：成功 %d、失敗 %d", task_id, len(success_ids), len(failed_ids))

    try:
        client.ack(task_id, {
            'status': 'SUCCESS',
            'successAssetIds': success_ids,
            'failedAssetIds': failed_ids,
        })
    except TaskApiError as e:
        # Ack 失敗會讓任務卡在 PROCESSING，但下一次全域掃描 Pull 會自動補上
        logger.error("[task %s] Ack 送出失敗: %s", task_id, e)


def main():
    WorkerFramework(TASK_TYPE, process_task).run()


if __name__ == '__main__':
    main()
