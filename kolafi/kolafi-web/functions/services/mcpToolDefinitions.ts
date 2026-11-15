/**
 * MCP 工具的名稱、說明與輸入格式。description 是給呼叫端的 AI 讀的，
 * 規則要寫清楚，AI 才會照著用。
 *
 * 新增工具的步驟：在這裡加名稱、說明與 inputSchema，寫一支處理函式，
 * 再到 `mcpService.ts` 的 `TOOL_HANDLERS` 登記。
 */

export const GET_CURRENT_TIME_TOOL_NAME = 'get_current_time'

const GET_CURRENT_TIME_DESCRIPTION = `唯讀。回傳伺服器現在的時間，不會改變任何資料。

使用規則：
- 沒有任何參數。
- 回傳欄位：now（台灣時間 UTC+8，帶 +08:00，精度到秒）、utc（UTC，帶 Z）、timezone（固定 Asia/Taipei）。`

export const TOOL_DEFINITIONS = [
  {
    name: GET_CURRENT_TIME_TOOL_NAME,
    description: GET_CURRENT_TIME_DESCRIPTION,
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
]
