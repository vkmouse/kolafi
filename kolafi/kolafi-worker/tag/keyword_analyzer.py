"""
關鍵詞分析與排序。

寫成不依賴全域狀態、不印 log 的純函式，方便單獨測試。
"""
from collections import Counter
from typing import List

import jieba

from logger import get_logger

logger = get_logger(__name__)

# 自訂詞彙表：避免常見品牌詞、專有名詞被 jieba 拆散
CUSTOM_WORDS = [
    '統一', '來一客', '杯麵', '泡麵', '方便麵',
    '麥當勞', 'McDonald', 'KFC', '肯德基', '星巴克', 'Starbucks',
    '提提研',
    'iPhone', 'iPad', 'Samsung', '三星', 'Apple', '蘋果',
    'PlayStation', 'Xbox', 'Nintendo', '任天堂',
    '7-Eleven', '全家', 'FamilyMart', 'OK便利店',
    '可口可樂', 'Coca-Cola', '百事可樂', 'Pepsi',
    '寶可夢', 'Pokemon', '神奇寶貝', '精靈寶可夢',
]

# 停用詞表：中英文常見虛詞 + 圖庫網站常見雜訊詞
STOP_WORDS = {
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一個',
    '上', '也', '很', '到', '說', '要', '去', '你', '會', '著', '沒有', '看', '好',
    '自己', '這', '為', '推薦', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at',
    'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be',
    'this', 'that', 'it', 'he', 'she', 'they', 'we', 'you', 'can', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', '', ' ', 'images',
    'image', 'photo', 'picture', 'pictures', 'photos', 'png', 'jpg', 'jpeg',
    'download', 'free', 'vector', 'vectors', 'illustration', 'illustrations',
}

_custom_words_loaded = False


def _ensure_custom_words_loaded() -> None:
    """jieba.add_word 是進程內全域狀態，只需加入一次即可沿用，避免重複呼叫。"""
    global _custom_words_loaded
    if _custom_words_loaded:
        return
    for word in CUSTOM_WORDS:
        jieba.add_word(word)
    _custom_words_loaded = True


def analyze_keywords(alt_texts: List[str], top_n: int = 10) -> List[str]:
    """把所有 alt 文字合併分詞，過濾單字詞與停用詞後，取詞頻最高的前 top_n 個詞。

    回傳空清單代表沒有可用關鍵詞，呼叫端會視為任務失敗。
    """
    _ensure_custom_words_loaded()

    combined_text = ' '.join(alt_texts)
    logger.info('合併文字長度: %d 字元', len(combined_text))

    words = jieba.cut(combined_text)
    filtered_words = [
        word.strip()
        for word in words
        if len(word.strip()) > 1 and word.strip().lower() not in STOP_WORDS
    ]
    logger.info('過濾後剩餘 %d 個詞彙', len(filtered_words))

    word_freq = Counter(filtered_words)
    top_keywords = word_freq.most_common(top_n)
    logger.info('詞頻 TOP %d: %s', top_n, top_keywords)

    return [word for word, _count in top_keywords]


def sort_keywords_by_project_name(project_name: str, keywords: List[str]) -> List[str]:
    """依專案名稱重新排序：先對 project_name 分詞，關鍵詞若出現在專案名稱中，
    依出現順序排到前面（忽略大小寫）；其餘維持原本詞頻排序接在後面。
    """
    _ensure_custom_words_loaded()

    project_words = [w.strip() for w in jieba.cut(project_name) if len(w.strip()) > 1]
    logger.info('專案名稱分詞: %s', project_words)

    # 原始大小寫的詞 -> 在專案名稱中第一次出現的位置，查詢時忽略大小寫
    project_word_positions = {}
    for idx, word in enumerate(project_words):
        word_lower = word.lower()
        if word_lower not in project_word_positions:
            project_word_positions[word_lower] = idx

    matched: List[tuple] = []
    unmatched: List[str] = []

    for keyword in keywords:
        position = project_word_positions.get(keyword.lower())
        if position is not None:
            matched.append((keyword, position))
        else:
            unmatched.append(keyword)

    matched.sort(key=lambda pair: pair[1])
    sorted_keywords = [keyword for keyword, _position in matched] + unmatched

    logger.info('排序後關鍵詞: %s', sorted_keywords)
    return sorted_keywords
