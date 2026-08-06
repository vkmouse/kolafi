"""
呼叫 Gemini API 的 HTTP client，供 CAPTION Worker 產生文案用。

直接打 REST API（`generateContent`）而不引入 `google-generativeai` SDK：只需要
「送 prompt、指定 temperature、拿回文字」這一種基本用法，`requests` 就能做完。

> 這份檔案是 CAPTION 專屬的業務邏輯模組，不需要複製到其他 worker 資料夾。
"""
import os

import requests

from logger import get_logger

logger = get_logger(__name__)


class GeminiApiError(Exception):
    """呼叫 Gemini API 本身失敗（連線錯誤、逾時、非預期狀態碼、回應格式錯誤、內容為空等）"""
    pass


class GeminiClient:
    def __init__(self, api_key: str = None, model: str = None, timeout_seconds: int = None, base_url: str = None):
        self.api_key = api_key if api_key is not None else os.environ.get('GEMINI_API_KEY', '')
        self.model = model or os.environ.get('GEMINI_MODEL', 'gemini-2.0-flash')
        self.timeout_seconds = timeout_seconds or int(os.environ.get('GEMINI_TIMEOUT_SECONDS', '60'))
        self.base_url = (base_url or os.environ.get('GEMINI_API_BASE_URL', 'https://generativelanguage.googleapis.com')).rstrip('/')

    def generate(self, prompt: str, temperature: float = 0.4) -> str:
        """失敗一律拋 GeminiApiError。"""
        if not self.api_key:
            raise GeminiApiError('未設定 GEMINI_API_KEY 環境變數')

        url = f"{self.base_url}/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        body = {
            'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {'temperature': temperature},
        }

        try:
            resp = requests.post(url, json=body, timeout=self.timeout_seconds)
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException as e:
            raise GeminiApiError(f"呼叫 Gemini API 失敗: {e}") from e
        except ValueError as e:
            raise GeminiApiError(f"Gemini API 回應不是合法 JSON: {e}") from e

        try:
            parts = data['candidates'][0]['content']['parts']
            text = ''.join(part.get('text', '') for part in parts)
        except (KeyError, IndexError, TypeError) as e:
            raise GeminiApiError(f"Gemini API 回應格式不符預期: {data}") from e

        if not text:
            raise GeminiApiError('Gemini API 回應內容是空的')

        logger.debug("Gemini 回應原始內容: %s", text)
        return text


_default_client = None


def _get_default_client() -> GeminiClient:
    global _default_client
    if _default_client is None:
        _default_client = GeminiClient()
    return _default_client


def generate(prompt: str, temperature: float = 0.4) -> str:
    """模組層級的便利函式，內部用單例 GeminiClient（環境變數只讀一次）。"""
    return _get_default_client().generate(prompt, temperature)
