"""
透過 web-sandbox 服務搜尋 Google 圖片並擷取候選文字。

只負責找圖片、讀屬性，不管理 session 生命週期。
"""
import time
from typing import List

from logger import get_logger
from web_sandbox_client import WebSandboxClient

logger = get_logger(__name__)

MAX_ALT_TEXTS = 100

# 用輪詢而非固定 sleep：抓到就立刻往下走，頁面慢時也不會等太短抓空
CONTAINER_WAIT_TIMEOUT_SECONDS = 10
POLL_INTERVAL_SECONDS = 0.5


def _wait_for_elements(client: WebSandboxClient, session_id: str, selector: str, timeout: float, interval: float = POLL_INTERVAL_SECONDS) -> List[str]:
    """輪詢直到 selector 對應的元素出現，或逾時。逾時回傳空清單（不拋例外），
    交由呼叫端依「找不到」的邏輯處理。"""
    deadline = time.monotonic() + timeout
    while True:
        element_ids = client.find_elements(session_id, selector)
        if element_ids:
            return element_ids
        if time.monotonic() >= deadline:
            return []
        time.sleep(interval)


def search_google_images(client: WebSandboxClient, session_id: str, query: str) -> List[str]:
    """導向 Google 圖片搜尋結果頁，回傳圖片 element_id 清單（可能為空）。

    web-sandbox 不支援捲動頁面，只能抓首屏結果。
    """
    search_url = f'https://www.google.com/search?q={query}&tbm=isch'
    logger.info('導向搜尋頁: %s', search_url)
    client.switch_url(session_id, search_url)

    logger.info('等待圖片容器出現 (div.uhHOwf，最多等 %.0f 秒)...', CONTAINER_WAIT_TIMEOUT_SECONDS)
    container_ids = _wait_for_elements(client, session_id, 'div.uhHOwf', timeout=CONTAINER_WAIT_TIMEOUT_SECONDS)
    logger.info('找到 %d 個圖片容器', len(container_ids))

    images: List[str] = []
    for container_id in container_ids:
        img_id = client.find_element(session_id, "img[id^='dimg_']", parent_element_id=container_id)
        if img_id is not None:
            images.append(img_id)

    logger.info('總共找到 %d 張可用圖片', len(images))
    return images


def extract_alt_texts(client: WebSandboxClient, session_id: str, images: List[str], max_count: int = MAX_ALT_TEXTS) -> List[str]:
    """依序取每張圖片的 alt 屬性文字，最多取前 max_count 張；alt 為空或純空白的圖片略過。"""
    alt_texts: List[str] = []

    for img_id in images[:max_count]:
        alt = client.get_attribute(session_id, img_id, 'alt')
        if alt and alt.strip():
            alt_texts.append(alt.strip())

    logger.info('成功提取 %d 個 alt 屬性', len(alt_texts))
    return alt_texts
