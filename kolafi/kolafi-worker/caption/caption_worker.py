"""
CAPTION Worker：呼叫 Gemini 產生文案，由 worker_framework 驅動執行。

跟 THUMBNAIL/CLEANUP 不同，CAPTION 是單一結果型任務：一筆任務只對應一次產生文案的請求，
Ack 沒有部分成功/失敗的清單，只有「這次有沒有產出文案」一個結果。
"""
import json
import random
import re

from logger import get_logger
from task_api_client import TaskApiClient, TaskApiError
from worker_framework import WorkerFramework

import gemini_client
from gemini_client import GeminiApiError

logger = get_logger('caption-worker')

TASK_TYPE = 'caption'

_CODE_FENCE_RE = re.compile(r'^```(?:json)?\s*\n?(.*?)\n?```$', re.DOTALL)


def _strip_code_fence(text: str) -> str:
    """LLM 回應可能包在 markdown code fence 裡，先剝除再解析 JSON；沒有就原樣回傳。"""
    stripped = text.strip()
    match = _CODE_FENCE_RE.match(stripped)
    return match.group(1).strip() if match else stripped


def _normalize_whitespace(value) -> str:
    """多個連續空白視為一個空格、去除頭尾空白，用於比對 name 與 projectName。
    非字串（例如 LLM 回應缺漏 name 欄位或型別不對）一律視為空字串，比對時自然不相等。"""
    if not isinstance(value, str):
        return ''
    return re.sub(r'\s+', ' ', value).strip()


def process_task(task_data: dict, client: TaskApiClient) -> None:
    """CAPTION 沒有部分成功的概念，任何一步失敗都直接 ack(FAILED) 並結束；
    只有走到最後「回應的 name 與專案名稱相符」才算成功。"""
    task_id = task_data['taskId']
    payload = task_data.get('payload') or {}
    project_name = payload.get('projectName')
    caption_configs = payload.get('captionConfigs') or []

    logger.info("[task %s] 開始處理，projectName=%r，captionConfigs 數量=%d", task_id, project_name, len(caption_configs))

    def fail(error_message: str) -> None:
        logger.warning("[task %s] 任務失敗: %s", task_id, error_message)
        try:
            client.ack(task_id, {'status': 'FAILED', 'error': error_message})
        except TaskApiError as e:
            logger.error("[task %s] Ack 送出失敗: %s", task_id, e)

    try:
        # projectName 為空代表任務指向的專案不存在；captionConfigs 為空代表使用者沒有設定提示詞
        if not project_name:
            fail('找不到專案')
            return
        if not caption_configs:
            fail('使用者沒有設定任何 CAPTION 提示詞')
            return

        config = random.choice(caption_configs)
        path = config.get('path') or ''

        try:
            with open(path, 'r', encoding='utf-8') as f:
                template = f.read()
        except OSError as e:
            fail(f"Prompt 檔案不存在: {path}" if not path else f"Prompt 檔案不存在: {path}（{e}）")
            return

        prompt = template.replace('{ITEMNAME}', project_name)

        try:
            raw_response = gemini_client.generate(prompt, temperature=0.4)
        except GeminiApiError as e:
            fail(str(e))
            return

        text = _strip_code_fence(raw_response)

        try:
            result = json.loads(text)
        except (ValueError, TypeError):
            fail('Gemini 回應不是有效的 JSON')
            return

        if not isinstance(result, dict):
            fail('Gemini 回應不是有效的 JSON')
            return

        name = result.get('name')
        caption = result.get('caption')

        if _normalize_whitespace(name) != _normalize_whitespace(project_name):
            fail(f"回應的 name 與專案名稱不符（期望：{project_name!r}，實際：{name!r}）")
            return

        if not isinstance(caption, str):
            fail('Gemini 回應缺少 caption 欄位')
            return

        logger.info("[task %s] 產生成功", task_id)

        try:
            client.ack(task_id, {'status': 'SUCCESS', 'caption': caption})
        except TaskApiError as e:
            # 會卡在 PROCESSING，CAPTION 沒有自動補救機制，需使用者重新觸發
            logger.error("[task %s] Ack 送出失敗: %s", task_id, e)
    except Exception as e:
        # 保底：避免未預期例外讓任務卡在 PROCESSING
        logger.exception("[task %s] 處理時發生未預期例外", task_id)
        fail(f"未預期錯誤: {e}")


def main():
    WorkerFramework(TASK_TYPE, process_task).run()


if __name__ == '__main__':
    main()
