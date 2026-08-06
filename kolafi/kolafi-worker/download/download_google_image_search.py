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
from typing import List
from urllib.parse import urlparse

from logger import get_logger
from web_sandbox_client import WebSandboxClient, WebSandboxError

logger = get_logger(__name__)

# 多掃一些候選縮圖，避免點擊失敗導致湊不滿目標張數
CANDIDATE_MULTIPLIER = 3

# 換頁後、點縮圖後固定等待的秒數
PAGE_LOAD_WAIT_SECONDS = 5
CLICK_PREVIEW_WAIT_SECONDS = 3


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


def collect_original_image_urls(client: WebSandboxClient, session_id: str, images: List[str], target_count: int) -> List[str]:
    """依序點擊縮圖觸發大圖預覽，取出原始圖網址，收集到 target_count 個就提前停止。

    略過 gstatic.com（縮圖網域）、非 http 開頭、或已收集過的重複網址；
    每張縮圖最多取一個有效網址。
    """
    image_urls: List[str] = []
    candidates = images[: target_count * CANDIDATE_MULTIPLIER]

    for img_id in candidates:
        try:
            client.click_element(session_id, img_id)
            time.sleep(CLICK_PREVIEW_WAIT_SECONDS)
            large_image_ids = client.find_elements(session_id, 'img.n3VNCb, img.sFlh5c')

            for large_img_id in large_image_ids:
                src = client.get_attribute(session_id, large_img_id, 'src')

                if src and 'gstatic.com' in src:
                    continue
                if src and src.startswith('http') and src not in image_urls:
                    image_urls.append(src)
                    break

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
