"""
kolafi 內部 Tasks API（Pull/Ack）的 HTTP client。

刻意不知道任何任務類型的 Ack payload schema（每種任務類型都不一樣），只負責打
HTTP、組路由、確認信封 success 欄位；schema 由呼叫端自己組好 dict 傳進來。
"""
import os
import requests

from logger import get_logger

logger = get_logger(__name__)


class TaskApiError(Exception):
    """呼叫內部 Tasks API 本身失敗（連線錯誤、逾時、非預期狀態碼、回應格式錯誤等）"""
    pass


class TaskApiClient:
    """
    路由規則：
        POST {base_url}/api/internal/tasks/{task_type}/pull
        POST {base_url}/api/internal/tasks/{task_type}/{task_id}/ack
    """

    def __init__(self, task_type: str, base_url: str = None, timeout_seconds: int = None):
        self.task_type = task_type
        self.base_url = (base_url or os.environ.get('KOLAFI_API_BASE_URL', 'http://localhost:8788')).rstrip('/')
        self.timeout_seconds = timeout_seconds or int(os.environ.get('KOLAFI_API_TIMEOUT_SECONDS', '30'))

    def pull(self):
        """回傳 None（沒有 PENDING 任務）或 { "taskId": ..., "payload": {...} }"""
        url = f"{self.base_url}/api/internal/tasks/{self.task_type}/pull"
        logger.debug("Pull %s: %s", self.task_type, url)
        try:
            resp = requests.post(url, timeout=self.timeout_seconds)
            resp.raise_for_status()
            body = resp.json()
        except requests.RequestException as e:
            raise TaskApiError(f"呼叫 {self.task_type} Pull API 失敗: {e}") from e
        except ValueError as e:
            raise TaskApiError(f"{self.task_type} Pull API 回應不是合法 JSON: {e}") from e

        if not body.get('success'):
            raise TaskApiError(f"{self.task_type} Pull API 回應 success=false: {body}")

        data = body.get('data')
        logger.debug("Pull %s: %s", self.task_type, "沒有 PENDING 任務" if data is None else f"拿到任務 {data.get('taskId')}")
        return data

    def ack(self, task_id: str, body: dict) -> None:
        """body 是呼叫端依該任務類型 Ack schema 組好的 dict，這裡只負責送出去"""
        url = f"{self.base_url}/api/internal/tasks/{self.task_type}/{task_id}/ack"
        logger.debug("Ack %s task %s: %s", self.task_type, task_id, body)
        try:
            resp = requests.post(url, json=body, timeout=self.timeout_seconds)
            resp.raise_for_status()
        except requests.RequestException as e:
            raise TaskApiError(f"呼叫 {self.task_type} Ack API 失敗: {e}") from e
