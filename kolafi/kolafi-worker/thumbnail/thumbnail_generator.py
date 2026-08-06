"""
縮圖產生邏輯：統一輸出 JPEG，品質 85，長邊不超過 320px，依原始長寬比縮小，不裁切、不變形。

PIL 的 Image.thumbnail((320, 320)) 效果等同於「長邊不超過 320」，因此直接沿用這個 API。
"""
import os
from PIL import Image
from moviepy.editor import VideoFileClip
import ffmpeg

from logger import get_logger

logger = get_logger(__name__)

THUMBNAIL_MAX_SIDE = 320
THUMBNAIL_QUALITY = 85


class ThumbnailGenerationError(Exception):
    """產生縮圖過程中發生的任何錯誤，呼叫端統一視為這個素材處理失敗"""
    pass


def generate_image_thumbnail(src_path: str, dst_path: str) -> None:
    """IMAGE 縮圖：轉 RGB（避免非 RGB 色彩模式存 JPEG 失敗）後依長邊縮小輸出。"""
    try:
        with Image.open(src_path) as img:
            if img.mode != 'RGB':
                logger.debug("圖片色彩模式 %s 轉換為 RGB: %s", img.mode, src_path)
                img = img.convert('RGB')

            img.thumbnail((THUMBNAIL_MAX_SIDE, THUMBNAIL_MAX_SIDE), Image.LANCZOS)

            os.makedirs(os.path.dirname(dst_path), exist_ok=True)
            img.save(dst_path, 'JPEG', quality=THUMBNAIL_QUALITY)
            logger.debug("圖片縮圖產生完成: %s -> %s", src_path, dst_path)
    except Exception as e:
        raise ThumbnailGenerationError(f"圖片縮圖失敗: {e}") from e


def _get_video_raw_info(video_path: str):
    """用 ffprobe 讀取原始寬高與旋轉角度中繼資料（手機直拍影片常見，0/90/180/270）"""
    probe = ffmpeg.probe(video_path)
    video_stream = next((s for s in probe['streams'] if s['codec_type'] == 'video'), None)
    if not video_stream:
        raise ThumbnailGenerationError("影片沒有可用的視訊串流")

    raw_width = int(video_stream['width'])
    raw_height = int(video_stream['height'])

    rotation = 0
    if 'tags' in video_stream and 'rotate' in video_stream['tags']:
        rotation = int(video_stream['tags']['rotate'])
    elif 'side_data_list' in video_stream:
        for side_data in video_stream['side_data_list']:
            if 'rotation' in side_data:
                rotation = int(side_data['rotation'])

    return raw_width, raw_height, rotation


def generate_video_thumbnail(src_path: str, dst_path: str) -> None:
    """VIDEO 縮圖：擷取一幀後轉正、縮小。moviepy 擷取到的畫面是原始寬高，不會套用
    旋轉中繼資料，所以要先手動 resize 成顯示寬高（90/270 度要對調寬高），否則直拍
    影片的縮圖方向會是錯的。擷取時間點取 min(0.5秒, 總長度/2) 避開開頭黑畫面。"""
    try:
        raw_width, raw_height, rotation = _get_video_raw_info(src_path)
        logger.debug(
            "影片原始資訊 %s: raw=%dx%d rotation=%d", src_path, raw_width, raw_height, rotation
        )

        if abs(rotation) in (90, 270):
            display_width, display_height = raw_height, raw_width
        else:
            display_width, display_height = raw_width, raw_height

        video = VideoFileClip(src_path)
        try:
            frame_time = min(0.5, video.duration / 2)
            frame = video.get_frame(frame_time)
        finally:
            video.close()

        img = Image.fromarray(frame)

        if display_width > 0 and display_height > 0:
            img = img.resize((display_width, display_height), Image.LANCZOS)

        if img.mode != 'RGB':
            img = img.convert('RGB')

        img.thumbnail((THUMBNAIL_MAX_SIDE, THUMBNAIL_MAX_SIDE), Image.LANCZOS)

        os.makedirs(os.path.dirname(dst_path), exist_ok=True)
        img.save(dst_path, 'JPEG', quality=THUMBNAIL_QUALITY)
        logger.debug("影片縮圖產生完成: %s -> %s", src_path, dst_path)
    except ThumbnailGenerationError:
        raise
    except Exception as e:
        raise ThumbnailGenerationError(f"影片縮圖失敗: {e}") from e


def generate_thumbnail(asset_type: str, src_path: str, dst_path: str) -> None:
    """依素材類型分派到對應的縮圖產生函式，未知類型直接視為失敗"""
    if asset_type == 'IMAGE':
        generate_image_thumbnail(src_path, dst_path)
    elif asset_type == 'VIDEO':
        generate_video_thumbnail(src_path, dst_path)
    else:
        raise ThumbnailGenerationError(f"未知素材類型: {asset_type}")
