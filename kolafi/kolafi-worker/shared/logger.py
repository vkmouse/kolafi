"""
統一的 logging 設定。所有檔案都應該透過 `get_logger()` 拿 logger，不要各自
`logging.basicConfig()` 或自訂格式，避免同一個進程裡出現不一致的 log 樣式。

用法：
    from logger import get_logger
    logger = get_logger(__name__)
"""
import logging
import os

_LOG_FORMAT = '%(asctime)s [%(levelname)s] [%(name)s] %(message)s'
_configured = False


def _ensure_configured() -> None:
    global _configured
    if _configured:
        return
    level_name = os.environ.get('LOG_LEVEL', 'INFO').upper()
    logging.basicConfig(level=getattr(logging, level_name, logging.INFO), format=_LOG_FORMAT)
    _configured = True


def get_logger(name: str) -> logging.Logger:
    """log level 可用環境變數 LOG_LEVEL 覆蓋，預設 INFO"""
    _ensure_configured()
    return logging.getLogger(name)
