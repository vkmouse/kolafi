export interface OAuthCodeRow {
  code: string
  client_id: string
  redirect_uri: string
  code_challenge: string
  /** 過期時間，epoch ms */
  expires_at: number
}

export async function insertOAuthCode(params: OAuthCodeRow, DB: D1Database): Promise<void> {
  const sql = `INSERT INTO oauth_codes (code, client_id, redirect_uri, code_challenge, expires_at)
    VALUES (?, ?, ?, ?, ?)`
  await DB.prepare(sql)
    .bind(params.code, params.client_id, params.redirect_uri, params.code_challenge, params.expires_at)
    .run()
}

/**
 * 以一條 SQL 取出並刪除 `code`，用完即刪，不論後續驗證成敗。同一個 `code` 同時送出兩次，
 * 只有一個請求拿得到記錄。不存在或已被取走時回傳 null。
 */
export async function consumeOAuthCode(code: string, DB: D1Database): Promise<OAuthCodeRow | null> {
  const sql = `DELETE FROM oauth_codes WHERE code = ?
    RETURNING code, client_id, redirect_uri, code_challenge, expires_at`
  return await DB.prepare(sql).bind(code).first<OAuthCodeRow>()
}
