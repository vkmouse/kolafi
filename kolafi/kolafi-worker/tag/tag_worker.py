"""
TAG Worker：分析專案名稱，透過 Google 圖片搜尋取得候選關鍵詞後排序。

單一結果型任務，只跟 project_id 有關，不需要 user_id。
"""
from logger import get_logger
from task_api_client import TaskApiClient, TaskApiError
from worker_framework import WorkerFramework
from web_sandbox_client import WebSandboxClient, WebSandboxError

import tag_google_image_search as google_image_search
import keyword_analyzer

logger = get_logger('tag-worker')

TASK_TYPE = 'tag'

KEYWORD_TOP_N = 10


def process_task(task_data: dict, client: TaskApiClient) -> None:
    """任何一步失敗就直接 ack(FAILED) 並結束，只有完整跑到排序完成才算成功。"""
    task_id = task_data['taskId']
    payload = task_data.get('payload') or {}
    project_name = payload.get('projectName')

    logger.info("[task %s] 開始處理，projectName=%r", task_id, project_name)

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
        try:
            sandbox_client = WebSandboxClient()
            session_id = sandbox_client.open_session('https://www.google.com')

            images = google_image_search.search_google_images(sandbox_client, session_id, project_name)
            if not images:
                fail('未找到圖片')
                return

            alt_texts = google_image_search.extract_alt_texts(sandbox_client, session_id, images)
            if not alt_texts:
                fail('無法提取 alt 屬性')
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

        keywords = keyword_analyzer.analyze_keywords(alt_texts, top_n=KEYWORD_TOP_N)
        if not keywords:
            fail('無法提取關鍵詞')
            return

        keywords = keyword_analyzer.sort_keywords_by_project_name(project_name, keywords)

        logger.info("[task %s] 分析完成，關鍵詞: %s", task_id, keywords)

        try:
            client.ack(task_id, {'status': 'SUCCESS', 'keywords': keywords})
        except TaskApiError as e:
            # 會卡在 PROCESSING，TAG 沒有自動補救機制，需使用者重新觸發
            logger.error("[task %s] Ack 送出失敗: %s", task_id, e)
    except Exception as e:
        # 保底：避免未預期例外讓任務卡在 PROCESSING
        logger.exception("[task %s] 處理時發生未預期例外", task_id)
        fail(f"未預期錯誤: {e}")


def main():
    WorkerFramework(TASK_TYPE, process_task).run()


if __name__ == '__main__':
    main()
