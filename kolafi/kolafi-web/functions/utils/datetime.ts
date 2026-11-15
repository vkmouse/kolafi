/** 台灣不實施日光節約時間，固定 UTC+8 */
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000

/** 把 Date 轉成帶 +08:00 的台灣時間字串（精度到秒），給 MCP 輸出用 */
export function toTaipeiIso(date: Date): string {
  return `${new Date(date.getTime() + TAIPEI_OFFSET_MS).toISOString().slice(0, 19)}+08:00`
}
