"""
DOWNLOAD Worker：搜尋 Google 圖片、下載原始檔並上傳到物件儲存。

單一結果型任務，只跟 project_id 有關，不需要 user_id。
"""
import hashlib
import os
import tempfile
import uuid

import requests

from logger import get_logger
from task_api_client import TaskApiClient, TaskApiError
from worker_framework import WorkerFramework
from web_sandbox_client import WebSandboxClient, WebSandboxError

import download_google_image_search as google_image_search
import s3_client

logger = get_logger('download-worker')

TASK_TYPE = 'download'

# 固定值，不從 Pull payload 帶入
DOWNLOAD_TARGET_COUNT = 25

DOWNLOAD_TIMEOUT_SECONDS = 10

_DOWNLOAD_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}


def _download_image_to_file(url: str, dest_dir: str, filename: str) -> str | None:
    """失敗不拋例外，避免單張下載失敗影響其他張。"""
    try:
        resp = requests.get(url, headers=_DOWNLOAD_HEADERS, timeout=DOWNLOAD_TIMEOUT_SECONDS, stream=True)
        resp.raise_for_status()

        file_path = os.path.join(dest_dir, filename)
        with open(file_path, 'wb') as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        return file_path
    except requests.RequestException as e:
        logger.warning('下載圖片失敗（略過，繼續下一張）: %s - %s', url, e)
        return None


def _upload_as_asset(file_path: str, extension: str, project_id: str) -> dict | None:
    """上傳失敗不拋例外，讓呼叫端可以略過並繼續下一張。"""
    asset_id = str(uuid.uuid4())
    key = s3_client.asset_key(project_id, asset_id, extension)
    try:
        s3_client.upload_file(file_path, key, content_type='image/jpeg')
        return {'id': asset_id, 'extension': extension}
    except Exception as e:
        logger.warning('上傳素材失敗（略過，繼續下一張）: %s - %s', key, e)
        return None


def process_task(task_data: dict, client: TaskApiClient) -> None:
    """只要這批有任一張成功下載並建立素材就整體回報成功，一張都沒有才算失敗。"""
    task_id = task_data['taskId']
    payload = task_data.get('payload') or {}
    project_name = payload.get('projectName')
    # projectId 用來組物件儲存的上傳路徑
    project_id = payload.get('projectId')

    logger.info("[task %s] 開始處理，projectId=%r projectName=%r", task_id, project_id, project_name)

    def fail(error_message: str) -> None:
        logger.warning("[task %s] 任務失敗: %s", task_id, error_message)
        try:
            client.ack(task_id, {'status': 'FAILED', 'error': error_message})
        except TaskApiError as e:
            logger.error("[task %s] Ack 送出失敗: %s", task_id, e)

    try:
        # projectName 為空代表任務指向的專案不存在
        if not project_name:
            fail('找不到專案')
            return

        sandbox_client = None
        session_id = None
        image_urls: list[str] = []
        try:
            sandbox_client = WebSandboxClient()
            session_id = sandbox_client.open_session('https://www.google.com')

            images = google_image_search.search_google_images(sandbox_client, session_id, project_name)
            if not images:
                fail('未找到圖片')
                return

            image_urls = google_image_search.collect_original_image_urls(
                sandbox_client, session_id, images, DOWNLOAD_TARGET_COUNT
            )
            if not image_urls:
                fail('無法取得圖片連結')
                return
        except WebSandboxError as e:
            fail(str(e))
            return
        finally:
            if sandbox_client is not None and session_id is not None:
                try:
                    sandbox_client.close_session(session_id)
                except WebSandboxError as e:
                    logger.warning("[task %s] 關閉 web-sandbox session 失敗（忽略）: %s", task_id, e)

        logger.info("[task %s] 共取得 %d 個圖片連結，開始下載", task_id, len(image_urls))

        # 只負責產生檔案並上傳，不建立 DB 紀錄
        created_assets: list[dict] = []
        with tempfile.TemporaryDirectory(prefix='download-worker-') as temp_dir:
            for i, url in enumerate(image_urls, 1):
                extension = google_image_search.guess_extension(url)
                url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
                filename = f'{i}_{url_hash}{extension}'

                file_path = _download_image_to_file(url, temp_dir, filename)
                if file_path is None:
                    continue

                asset = _upload_as_asset(file_path, extension, project_id or '')
                if asset is not None:
                    created_assets.append(asset)

        if not created_assets:
            fail('沒有成功下載任何素材')
            return

        logger.info("[task %s] 成功建立 %d/%d 個素材", task_id, len(created_assets), len(image_urls))

        try:
            client.ack(task_id, {'status': 'SUCCESS', 'assets': created_assets})
        except TaskApiError as e:
            # 會卡在 PROCESSING，DOWNLOAD 沒有自動補救機制，需使用者重新觸發
            logger.error("[task %s] Ack 送出失敗: %s", task_id, e)
    except Exception as e:
        # 保底：避免未預期例外讓任務卡在 PROCESSING
        logger.exception("[task %s] 處理時發生未預期例外", task_id)
        fail(f"未預期錯誤: {e}")


def main():
    WorkerFramework(TASK_TYPE, process_task).run()


if __name__ == '__main__':
    main()
