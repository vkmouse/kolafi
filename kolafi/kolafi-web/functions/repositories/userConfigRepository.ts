/** 不同 config_name 的查詢邏輯完全一樣，共用同一個函式，不用各自拆一份 */

export interface UserConfigRow {
  id: string
  data: string
}

/** 整批回傳、不篩選不挑選——要用哪一筆、清單為空時如何處理，交由呼叫端決定 */
export async function listUserConfigsByUserAndName(userId: string, configName: string, DB: D1Database): Promise<UserConfigRow[]> {
  const sql = `SELECT id, data FROM user_configs WHERE user_id = ? AND config_name = ? ORDER BY created_at ASC`
  const result = await DB.prepare(sql)
    .bind(userId, configName)
    .all<UserConfigRow>()
  return result.results ?? []
}
