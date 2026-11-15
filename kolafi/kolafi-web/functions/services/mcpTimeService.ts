import { toTaipeiIso } from '../utils/datetime'

/** MCP 工具 get_current_time：唯讀，回傳伺服器現在的時間；沒有參數，也不碰資料庫 */
export function getCurrentTimeTool() {
  const now = new Date()
  return {
    now: toTaipeiIso(now),
    utc: now.toISOString(),
    timezone: 'Asia/Taipei',
  }
}
