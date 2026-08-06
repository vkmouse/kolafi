"""
四種 EXPORT_* 設定的挑選邏輯：各自的 configs 清單隨機挑選一筆使用，選中設定的 data
物件跟預設值合併（data 裡有的欄位覆蓋預設值，沒有的欄位保留預設值）；清單為空時
直接用內建預設值。隨機挑選與合併完全是 Worker 端的事，Pull 回傳的清單本身不做篩選。
"""
import random

DEFAULT_BGM = {
    'path': '',
    'volume': 0.3,
}

DEFAULT_SUBTITLE = {
    'font': 'Noto-Sans-CJK-TC-Bold',
    'fontsize': 65,
    'color': 'white',
    'stroke_color': 'black',
    'stroke_width': 12,
    'position': 0.75,
}

DEFAULT_VOICE = {
    'tts_model': 'zh-TW-HsiaoChenNeural',
    'rate': '+100%',
    'pitch': '+18Hz',
}

DEFAULT_FRAME = {
    'path': '',
}


def _select_and_merge(configs, defaults):
    """configs 是 Pull 回傳的原始清單（每筆 {"id":..., "data": {...}}），隨機挑一筆跟預設值合併；
    清單為空直接回傳預設值的複本（避免呼叫端不小心改到 module-level 的預設值 dict）。"""
    merged = dict(defaults)
    if not configs:
        return merged

    selected = random.choice(configs)
    data = selected.get('data') or {}
    merged.update(data)
    return merged


def select_bgm(configs):
    return _select_and_merge(configs, DEFAULT_BGM)


def select_subtitle(configs):
    return _select_and_merge(configs, DEFAULT_SUBTITLE)


def select_voice(configs):
    return _select_and_merge(configs, DEFAULT_VOICE)


def select_frame(configs):
    return _select_and_merge(configs, DEFAULT_FRAME)
