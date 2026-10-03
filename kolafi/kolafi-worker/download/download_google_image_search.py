"""
透過 web-sandbox 服務搜尋 Google 圖片、依序點擊縮圖取得原始圖網址。

圖片容器/縮圖 CSS selector 跟 tag/tag_google_image_search.py 共用同一套
（都是 Google 圖片搜尋結果頁），但這裡多一步點擊縮圖、從大圖預覽區塊取原始網址。

注意：這個檔名故意跟 tag/ 底下那份不一樣（原本兩邊都叫 google_image_search.py）。
kolafi-worker 的 main.py 把 tag/、download/ 等六個子資料夾都塞進同一份
sys.path、跑在同一個 process 裡，兩個同名但內容不同的模組會互相蓋掉彼此
（哪個先被 import 就贏），造成另一邊呼叫不到自己需要的函式。改成不同檔名，
讓兩邊在 sys.modules 裡各自獨立，才不會有這個問題。
"""
import os
import time
from typing import List, Optional
from urllib.parse import urlparse

from logger import get_logger
from web_sandbox_client import WebSandboxClient, WebSandboxError

logger = get_logger(__name__)

# 多掃一些候選縮圖，避免點擊失敗導致湊不滿目標張數
CANDIDATE_MULTIPLIER = 3

# 換頁後、點縮圖後固定等待的秒數
PAGE_LOAD_WAIT_SECONDS = 5
CLICK_PREVIEW_WAIT_SECONDS = 3

# 點擊縮圖後，大圖預覽區塊裡的 <img> selector，依序嘗試，找到可用網址就停。
# Google 會不定期換 class，所以第一組放已知的大圖 class / jsname，
# 第二組是 fallback：直接抓預覽面板內所有 http 圖片，再靠 _is_original_url 過濾。
LARGE_IMAGE_SELECTORS = (
    'img.n3VNCb, img.sFlh5c, img.iPVvYb, img[jsname="HiaYvf"], img[jsname="kn3ccd"]',
    'div[role="dialog"] img[src^="http"], #Sva75c img[src^="http"]',
)


def search_google_images(client: WebSandboxClient, session_id: str, query: str) -> List[str]:
    """導向 Google 圖片搜尋結果頁，回傳圖片縮圖 element_id 清單（可能為空清單）。"""
    search_url = f'https://www.google.com/search?q={query}&tbm=isch'
    logger.info('導向搜尋頁: %s', search_url)
    client.switch_url(session_id, search_url)

    logger.info('等待圖片載入... (%.0f 秒)', PAGE_LOAD_WAIT_SECONDS)
    time.sleep(PAGE_LOAD_WAIT_SECONDS)

    logger.info('尋找圖片容器 (div.uhHOwf)...')
    container_ids = client.find_elements(session_id, 'div.uhHOwf')
    logger.info('找到 %d 個圖片容器', len(container_ids))

    images: List[str] = []
    for container_id in container_ids:
        img_id = client.find_element(session_id, "img[id^='dimg_']", parent_element_id=container_id)
        if img_id is not None:
            images.append(img_id)

    logger.info('總共找到 %d 張可用圖片', len(images))
    return images


def _is_original_url(src: Optional[str], thumb_src: Optional[str], collected: List[str]) -> bool:
    """判斷這個 src 是不是可以拿去下載的原始圖網址。

    排除：空值、非 http 開頭（含 data: URI）、Google 縮圖網域（gstatic.com）、
    Google 自家網域（google.com，如 favicon / 內部頁面）、跟被點的縮圖同一張、已收集過的重複網址。
    """
    if not src or not src.startswith('http'):
        return False
    if 'gstatic.com' in src:
        return False
    host = urlparse(src).netloc.lower()
    if host == 'google.com' or host.endswith('.google.com'):
        return False
    if src == thumb_src or src in collected:
        return False
    return True


def _find_original_url(client: WebSandboxClient, session_id: str, thumb_src: Optional[str], collected: List[str]) -> Optional[str]:
    """在已點開的預覽區塊找第一個可下載的原始圖網址，找不到回傳 None。"""
    for selector in LARGE_IMAGE_SELECTORS:
        large_image_ids = client.find_elements(session_id, selector)
        logger.info('大圖 selector「%s」找到 %d 個元素', selector, len(large_image_ids))

        for large_img_id in large_image_ids:
            src = client.get_attribute(session_id, large_img_id, 'src')
            if _is_original_url(src, thumb_src, collected):
                return src
    return None


def collect_original_image_urls(client: WebSandboxClient, session_id: str, images: List[str], target_count: int) -> List[str]:
    """依序點擊縮圖觸發大圖預覽，取出原始圖網址，收集到 target_count 個就提前停止。

    每張縮圖最多取一個有效網址，判斷規則見 _is_original_url。
    """
    image_urls: List[str] = []
    candidates = images[: target_count * CANDIDATE_MULTIPLIER]

    for index, img_id in enumerate(candidates, 1):
        try:
            thumb_src = client.get_attribute(session_id, img_id, 'src')

            client.click_element(session_id, img_id)
            time.sleep(CLICK_PREVIEW_WAIT_SECONDS)

            src = _find_original_url(client, session_id, thumb_src, image_urls)
            if src is None:
                logger.info('第 %d/%d 張點擊後找不到可用大圖，略過', index, len(candidates))
                continue

            image_urls.append(src)
            logger.info('第 %d/%d 張取得原始圖網址（目前共 %d 張）: %s', index, len(candidates), len(image_urls), src[:80])

            if len(image_urls) >= target_count:
                break
        except WebSandboxError as e:
            logger.warning('點擊縮圖或取得大圖網址失敗（略過這張，繼續下一張）: %s', e)
            continue

    logger.info('共收集到 %d 個原始圖網址', len(image_urls))
    return image_urls


def guess_extension(url: str) -> str:
    """從網址推測副檔名，無法判斷時預設 .jpg。"""
    try:
        ext = os.path.splitext(urlparse(url).path)[1]
    except Exception:
        ext = ''
    return ext if ext else '.jpg'
