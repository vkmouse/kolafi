"""
EXPORT Worker：下載素材、挑選設定、合成影片、上傳，由 worker_framework 驅動執行。

EXPORT 是單一結果型任務，沒有「批次中部分成功」的概念：任何一步沒有走到「合成成功、
上傳成功」，整筆任務就是 FAILED，跟 THUMBNAIL/CLEANUP 那種批次型任務完全不同。
"""
import os
import tempfile
import uuid

from logger import get_logger
from task_api_client import TaskApiClient, TaskApiError
from worker_framework import WorkerFramework

import config_selector
import s3_client
import video_composer

logger = get_logger('export-worker')

TASK_TYPE = 'export'


class ExportTaskError(Exception):
    """任何步驟失敗都以此例外統一攜帶錯誤訊息"""
    pass


def _download_asset(asset: dict, tmpdir: str) -> str:
    """找不到或連線錯誤都視為整筆任務失敗，EXPORT 沒有「單一素材失敗、其他繼續」的概念。"""
    asset_id = asset['id']
    extension = asset['extension']
    source_id = asset['sourceId']

    key = s3_client.asset_key(source_id, asset_id, extension)
    local_path = os.path.join(tmpdir, f"{asset_id}{extension}")

    try:
        found = s3_client.download_to_file(key, local_path)
    except Exception as e:
        raise ExportTaskError(f"素材 {asset_id} 下載失敗: {e}") from e

    if not found:
        raise ExportTaskError(f"素材 {asset_id} 下載失敗: 找不到原始檔 {key}")

    return local_path


def _run_export(payload: dict, tmpdir: str) -> str:
    """執行匯出全流程，回傳這次匯出的 exportId。任何一步失敗直接拋出 ExportTaskError。"""
    project_id = payload.get('projectId')
    caption = payload.get('caption') or ''
    export_params = payload.get('exportParams') or {}
    assets = payload.get('assets', [])

    if not project_id:
        raise ExportTaskError('找不到專案')

    if not assets:
        raise ExportTaskError('專案沒有素材')

    # payload.assets 已依專案最終選定清單排序；只取第一支影片、全部圖片
    videos = [a for a in assets if a.get('type') == 'VIDEO']
    images = [a for a in assets if a.get('type') == 'IMAGE']

    if not videos:
        raise ExportTaskError('專案沒有影片素材')

    video_asset = videos[0]
    logger.info(
        "使用影片素材 %s，%d 張圖片素材（清單中若有其他影片素材則不使用）",
        video_asset.get('id'), len(images),
    )

    try:
        resolution = export_params['resolution']
        width_str, height_str = resolution.split('x')
        width, height = int(width_str), int(height_str)
        video_duration = float(export_params['video_duration'])
        total_duration = float(export_params['total_duration'])
    except Exception as e:
        raise ExportTaskError(f"匯出參數格式錯誤: {e}") from e

    if total_duration <= video_duration:
        raise ExportTaskError('總長度必須大於影片長度')

    subtitle_config = config_selector.select_subtitle(payload.get('subtitleConfigs', []))
    voice_config = config_selector.select_voice(payload.get('voiceConfigs', []))
    bgm_config = config_selector.select_bgm(payload.get('bgmConfigs', []))
    frame_config = config_selector.select_frame(payload.get('frameConfigs', []))

    video_path = _download_asset(video_asset, tmpdir)
    image_paths = [_download_asset(a, tmpdir) for a in images]

    export_id = str(uuid.uuid4())
    output_path = os.path.join(tmpdir, f"export_{export_id}.mp4")

    try:
        video_composer.compose(
            video_path=video_path,
            image_paths=image_paths,
            caption=caption,
            width=width,
            height=height,
            video_duration=video_duration,
            total_duration=total_duration,
            subtitle_config=subtitle_config,
            voice_config=voice_config,
            bgm_config=bgm_config,
            frame_config=frame_config,
            output_path=output_path,
            tmpdir=tmpdir,
        )
    except video_composer.VideoCompositionError as e:
        raise ExportTaskError(str(e)) from e

    if not os.path.exists(output_path):
        raise ExportTaskError('影片合成失敗，找不到輸出檔案')

    export_object_key = s3_client.export_key(project_id, export_id)
    try:
        s3_client.upload_file(output_path, export_object_key, content_type='video/mp4')
    except Exception as e:
        raise ExportTaskError(f"上傳匯出影片失敗: {e}") from e

    return export_id


def process_task(task_data: dict, client: TaskApiClient) -> None:
    """EXPORT 沒有部分成功的概念，最終 Ack 只會是 SUCCESS 或 FAILED 其中一種。"""
    task_id = task_data['taskId']
    payload = task_data.get('payload', {})

    logger.info("[task %s] 開始處理匯出任務", task_id)

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            export_id = _run_export(payload, tmpdir)
        logger.info("[task %s] 匯出完成，exportId=%s", task_id, export_id)
        ack_body = {'status': 'SUCCESS', 'exportId': export_id}
    except ExportTaskError as e:
        logger.warning("[task %s] 匯出失敗: %s", task_id, e)
        ack_body = {'status': 'FAILED', 'error': str(e)}
    except Exception as e:
        # 保底：任何沒有包成 ExportTaskError 的未預期例外，同樣視為整筆任務失敗
        logger.exception("[task %s] 處理時發生未預期例外", task_id)
        ack_body = {'status': 'FAILED', 'error': f"未預期錯誤: {e}"}

    try:
        client.ack(task_id, ack_body)
    except TaskApiError as e:
        # 會卡在 PROCESSING，EXPORT 沒有自動補救機制，需使用者重新觸發
        logger.error("[task %s] Ack 送出失敗: %s", task_id, e)


def main():
    WorkerFramework(TASK_TYPE, process_task).run()


if __name__ == '__main__':
    main()
