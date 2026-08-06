"""
影片合成邏輯：小短片變速 + 圖片黑邊置中 + TTS 字幕雙層疊加 + BGM/套圖框。

  - 主影片片段一律拉伸填滿畫面（不保留長寬比）；圖片片段則保留長寬比、置中貼滿黑底，兩者視覺處理刻意不同
  - 沒有圖片素材時，圖片片段時長沒有內容可以填補，行為留待之後再調整
"""
import asyncio
import os

import numpy as np
import PIL.Image
if not hasattr(PIL.Image, 'ANTIALIAS'):
    PIL.Image.ANTIALIAS = PIL.Image.LANCZOS

import edge_tts
from moviepy.editor import (
    AudioFileClip,
    CompositeAudioClip,
    CompositeVideoClip,
    ImageClip,
    TextClip,
    VideoFileClip,
    afx,
    concatenate_videoclips,
    vfx,
)
from moviepy.video.tools.subtitles import SubtitlesClip

from logger import get_logger

logger = get_logger(__name__)

SUBTITLE_TEXT_WIDTH_RATIO = 0.9


class VideoCompositionError(Exception):
    """收斂所有合成失敗成同一型別，讓呼叫端統一處理"""
    pass


def _process_video_clip(video_path: str, target_duration: float, width: int, height: int):
    try:
        video = VideoFileClip(video_path).without_audio()
        video = video.resize(newsize=(width, height))

        speed_factor = video.duration / target_duration
        logger.debug("主影片原始長度 %.2fs，速度倍率 %.2fx", video.duration, speed_factor)

        video = video.fx(vfx.speedx, factor=speed_factor)
        video = video.set_duration(target_duration)
        return video
    except Exception as e:
        raise VideoCompositionError(f"主影片片段處理失敗: {e}") from e


def _process_image_clips(image_paths: list, section_duration: float, width: int, height: int):
    if not image_paths:
        return []

    per_image_duration = section_duration / len(image_paths)
    clips = []

    for img_path in image_paths:
        try:
            pil_img = PIL.Image.open(img_path)
            if pil_img.mode != 'RGB':
                pil_img = pil_img.convert('RGB')

            orig_w, orig_h = pil_img.size
            ratio = min(width / orig_w, height / orig_h)
            new_w = max(1, int(orig_w * ratio))
            new_h = max(1, int(orig_h * ratio))
            resized_img = pil_img.resize((new_w, new_h), PIL.Image.LANCZOS)

            background = PIL.Image.new('RGB', (width, height), (0, 0, 0))
            x_offset = (width - new_w) // 2
            y_offset = (height - new_h) // 2
            background.paste(resized_img, (x_offset, y_offset))

            img_clip = ImageClip(np.array(background)).set_duration(per_image_duration)
            clips.append(img_clip)
        except Exception as e:
            raise VideoCompositionError(f"圖片片段處理失敗（{img_path}）: {e}") from e

    return clips


async def _generate_tts(text: str, audio_path: str, sub_maker: 'edge_tts.SubMaker', tts_model: str, rate: str, pitch: str):
    communicate = edge_tts.Communicate(text, tts_model, rate=rate, pitch=pitch)
    with open(audio_path, 'wb') as f:
        async for chunk in communicate.stream():
            if chunk['type'] == 'audio':
                f.write(chunk['data'])
            elif chunk['type'] in ('WordBoundary', 'SentenceBoundary'):
                sub_maker.feed(chunk)


def _process_voice_and_subtitles(caption: str, width: int, height: int, subtitle_config: dict, voice_config: dict, tmpdir: str):
    """caption 為空時回傳 (None, None, None)，非任務失敗。"""
    if not caption:
        return None, None, None

    tts_model = voice_config['tts_model']
    rate = voice_config['rate']
    pitch = voice_config['pitch']

    font = subtitle_config['font']
    fontsize = subtitle_config['fontsize']
    main_color = subtitle_config['color']
    stroke_color = subtitle_config['stroke_color']
    stroke_width = subtitle_config['stroke_width']
    position = subtitle_config['position']

    audio_path = os.path.join(tmpdir, 'tts_audio.mp3')
    srt_path = os.path.join(tmpdir, 'subtitles.srt')

    try:
        sub_maker = edge_tts.SubMaker()
        asyncio.run(_generate_tts(caption, audio_path, sub_maker, tts_model, rate, pitch))

        audio_clip = AudioFileClip(audio_path)

        srt_content = sub_maker.get_srt().replace('。', '')  # 移除句號，避免字幕畫面出現多餘標點
        with open(srt_path, 'w', encoding='utf-8') as f:
            f.write(srt_content)

        text_width = width * SUBTITLE_TEXT_WIDTH_RATIO

        stroke_generator = lambda txt: TextClip(
            txt, font=font, fontsize=fontsize, color=stroke_color, stroke_color=stroke_color,
            stroke_width=stroke_width, method='caption', size=(text_width, None),
        )
        stroke_clip = SubtitlesClip(srt_path, make_textclip=stroke_generator)
        stroke_clip = stroke_clip.set_position(('center', height * position))

        # 垂直位置比描邊層多偏移 stroke_width / 2，避免兩層文字視覺上對不齊
        main_generator = lambda txt: TextClip(
            txt, font=font, fontsize=fontsize, color=main_color, method='caption', size=(text_width, None),
        )
        main_clip = SubtitlesClip(srt_path, make_textclip=main_generator)
        main_clip = main_clip.set_position(('center', height * position + stroke_width / 2))

        return audio_clip, stroke_clip, main_clip
    except Exception as e:
        raise VideoCompositionError(f"語音與字幕產生失敗: {e}") from e


def compose(
    video_path: str,
    image_paths: list,
    caption: str,
    width: int,
    height: int,
    video_duration: float,
    total_duration: float,
    subtitle_config: dict,
    voice_config: dict,
    bgm_config: dict,
    frame_config: dict,
    output_path: str,
    tmpdir: str,
) -> None:
    """total_duration <= video_duration 由呼叫端保證，這裡不重複檢查。"""
    clips = [_process_video_clip(video_path, video_duration, width, height)]

    image_section_duration = total_duration - video_duration
    clips.extend(_process_image_clips(image_paths, image_section_duration, width, height))

    audio_clip, stroke_subtitles_clip, main_subtitles_clip = _process_voice_and_subtitles(
        caption, width, height, subtitle_config, voice_config, tmpdir
    )

    try:
        final_clip = concatenate_videoclips(clips, method='compose')
        final_clip = final_clip.set_duration(total_duration)

        # 兩者都有就混音，只有一個就用那一個，都沒有就無聲
        audio_tracks = []
        bgm_path = bgm_config['path']
        if bgm_path and os.path.exists(bgm_path):
            bgm = AudioFileClip(bgm_path)
            bgm = afx.audio_loop(bgm, duration=total_duration)
            bgm = bgm.set_duration(total_duration)
            bgm = bgm.volumex(bgm_config['volume'])
            audio_tracks.append(bgm)
        elif bgm_path:
            logger.info("找不到 BGM 檔案 %s，這次沒有背景音樂", bgm_path)

        if audio_clip:
            audio_tracks.append(audio_clip)

        has_audio = len(audio_tracks) > 0
        if has_audio:
            mixed_audio = CompositeAudioClip(audio_tracks)
            final_clip = final_clip.set_audio(mixed_audio)

        # 字幕（只有產生語音時才有）
        video_layers = [final_clip]
        if audio_clip and stroke_subtitles_clip and main_subtitles_clip:
            video_layers.extend([stroke_subtitles_clip, main_subtitles_clip])

        # 套圖框疊在最上層
        frame_path = frame_config['path']
        if frame_path and os.path.exists(frame_path):
            frame_img = PIL.Image.open(frame_path)
            if frame_img.mode != 'RGBA':
                frame_img = frame_img.convert('RGBA')
            frame_img = frame_img.resize((width, height), PIL.Image.LANCZOS)
            frame_clip = ImageClip(np.array(frame_img), ismask=False).set_duration(total_duration)
            video_layers.append(frame_clip)
        elif frame_path:
            logger.info("找不到套圖框檔案 %s，這次沒有套圖框", frame_path)

        if len(video_layers) > 1:
            final_clip = CompositeVideoClip(video_layers)

        final_clip.write_videofile(
            output_path,
            fps=30,
            codec='libx264',
            audio_codec='aac',
            audio=has_audio,
            logger=None,
        )

        if audio_clip:
            audio_clip.close()
    except VideoCompositionError:
        raise
    except Exception as e:
        raise VideoCompositionError(f"影片合成／輸出失敗: {e}") from e
