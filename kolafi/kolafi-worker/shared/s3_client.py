"""
物件儲存（S3 相容，實際部署為 MinIO）存取層。合併自 thumbnail/cleanup/export/download
四個 worker 原本各自的 s3_client.py（caption、tag 這兩種任務類型不碰物件儲存，沒有對應內容）。

Key 規則：
  assets/{source_id}/{asset_id}{extension}        原始素材檔
  thumbs/{source_id}/{asset_id}.jpg                縮圖
  exports/{project_id}/export_{export_id}.mp4      匯出結果

各任務類型只會用到其中一部分 key builder / verb（例如 cleanup 只刪除、download 只上傳），
呼叫端自行挑選要用的函式即可，這份檔案不區分任務類型。
"""
import os
import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import ClientError

from logger import get_logger

logger = get_logger(__name__)

S3_ENDPOINT = os.environ.get('S3_ENDPOINT', 'http://localhost:9000')
S3_REGION = os.environ.get('S3_REGION', 'us-east-1')
S3_ACCESS_KEY_ID = os.environ.get('S3_ACCESS_KEY_ID', '')
S3_SECRET_ACCESS_KEY = os.environ.get('S3_SECRET_ACCESS_KEY', '')
S3_BUCKET = os.environ.get('S3_BUCKET', 'kolafi')
S3_FORCE_PATH_STYLE = os.environ.get('S3_FORCE_PATH_STYLE', 'true') == 'true'

_client = None


def get_s3_client():
    global _client
    if _client is None:
        logger.debug("初始化 S3 client，endpoint=%s bucket=%s", S3_ENDPOINT, S3_BUCKET)
        _client = boto3.client(
            's3',
            endpoint_url=S3_ENDPOINT,
            region_name=S3_REGION,
            aws_access_key_id=S3_ACCESS_KEY_ID,
            aws_secret_access_key=S3_SECRET_ACCESS_KEY,
            config=BotoConfig(
                s3={'addressing_style': 'path' if S3_FORCE_PATH_STYLE else 'auto'}
            ),
        )
    return _client


def asset_key(source_id, asset_id, extension):
    return f"assets/{source_id}/{asset_id}{extension}"


def thumbnail_key(source_id, asset_id):
    return f"thumbs/{source_id}/{asset_id}.jpg"


def export_key(project_id, export_id):
    return f"exports/{project_id}/export_{export_id}.mp4"


def download_to_file(key, dest_path):
    """物件不存在回傳 False；其他錯誤直接拋出，由呼叫端視為處理失敗。"""
    client = get_s3_client()
    logger.debug("下載 %s -> %s", key, dest_path)
    try:
        client.download_file(S3_BUCKET, key, dest_path)
        return True
    except ClientError as e:
        code = e.response.get('Error', {}).get('Code', '')
        if code in ('404', 'NoSuchKey'):
            logger.debug("找不到物件 %s（404/NoSuchKey）", key)
            return False
        logger.warning("下載 %s 失敗: %s", key, e)
        raise


def upload_file(local_path, key, content_type='image/jpeg'):
    client = get_s3_client()
    logger.debug("上傳 %s -> %s", local_path, key)
    client.upload_file(
        local_path, S3_BUCKET, key,
        ExtraArgs={'ContentType': content_type},
    )


def delete_object(key):
    """刪除物件。找不到這個 key（404/NoSuchKey）視為刪除成功；其他錯誤直接拋出，
    由呼叫端視為這個素材處理失敗。"""
    client = get_s3_client()
    logger.debug("刪除 %s", key)
    try:
        client.delete_object(Bucket=S3_BUCKET, Key=key)
    except ClientError as e:
        code = e.response.get('Error', {}).get('Code', '')
        if code in ('404', 'NoSuchKey'):
            logger.debug("刪除 %s：物件本來就不存在（404/NoSuchKey），視為成功", key)
            return True
        logger.warning("刪除 %s 失敗: %s", key, e)
        raise
    return True
