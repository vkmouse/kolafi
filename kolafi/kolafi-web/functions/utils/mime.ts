/** 副檔名（小寫）對應 Content-Type，供上傳與代理下載（原始檔）時使用 */
const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
  '.webm': 'video/webm',
}

/** 依副檔名回傳 Content-Type，找不到對應時回傳通用二進位類型 */
export function mimeTypeByExtension(extension: string): string {
  return MIME_TYPES[extension.toLowerCase()] ?? 'application/octet-stream'
}
