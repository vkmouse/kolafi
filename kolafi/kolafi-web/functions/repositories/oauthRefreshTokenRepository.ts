export interface OAuthRefreshTokenRow {
  /** refresh token 明文的 SHA-256，小寫 16 進位；明文不落地 */
  token_hash: string
  /** 同一條鏈（經輪替串起來的所有 token）共用的識別 */
  family_id: string
  client_id: string
  /** 被使用的時間，epoch ms；null 表示尚未使用（鏈的最新一個） */
  used_at: number | null
  /** 閒置到期時間，epoch ms；每次輪替發出的新 token 重新計算 */
  idle_expires_at: number
  /** 絕對到期時間，epoch ms；同一條鏈相同，輪替不改變 */
  absolute_expires_at: number
}

/** 標記為已使用時回傳的欄位，足夠後續驗證與輪替使用 */
export type UsedOAuthRefreshTokenRow = Pick<
  OAuthRefreshTokenRow,
  'family_id' | 'client_id' | 'idle_expires_at' | 'absolute_expires_at'
>

/** 新增一條鏈的第一列，`used_at` 為 NULL */
export async function insertOAuthRefreshToken(
  params: Omit<OAuthRefreshTokenRow, 'used_at'>,
  DB: D1Database,
): Promise<void> {
  const sql = `INSERT INTO oauth_refresh_tokens (token_hash, family_id, client_id, idle_expires_at, absolute_expires_at)
    VALUES (?, ?, ?, ?, ?)`
  await DB.prepare(sql)
    .bind(params.token_hash, params.family_id, params.client_id, params.idle_expires_at, params.absolute_expires_at)
    .run()
}

/**
 * 以一條 SQL 把尚未使用的 token 標記為已使用。同一個 token 同時送出兩次，只有一個請求
 * 拿得到記錄。不存在或已被使用時回傳 null。
 */
export async function markOAuthRefreshTokenUsed(
  tokenHash: string,
  now: number,
  DB: D1Database,
): Promise<UsedOAuthRefreshTokenRow | null> {
  const sql = `UPDATE oauth_refresh_tokens SET used_at = ?
    WHERE token_hash = ? AND used_at IS NULL
    RETURNING family_id, client_id, idle_expires_at, absolute_expires_at`
  return await DB.prepare(sql).bind(now, tokenHash).first<UsedOAuthRefreshTokenRow>()
}

/** 依 token 雜湊查所屬的鏈，不論該列是否已使用；查不到回傳 null */
export async function getOAuthRefreshTokenFamilyId(tokenHash: string, DB: D1Database): Promise<string | null> {
  const sql = 'SELECT family_id FROM oauth_refresh_tokens WHERE token_hash = ?'
  const row = await DB.prepare(sql).bind(tokenHash).first<{ family_id: string }>()
  return row?.family_id ?? null
}

/** 作廢整條鏈：刪除該 `family_id` 的所有列，包含尚未使用的最新一列 */
export async function deleteOAuthRefreshTokenFamily(familyId: string, DB: D1Database): Promise<void> {
  const sql = 'DELETE FROM oauth_refresh_tokens WHERE family_id = ?'
  await DB.prepare(sql).bind(familyId).run()
}

/**
 * 輪替時寫入新列，欄位承襲舊列。有條件寫入：舊列已被並行請求作廢而消失時不會寫入，
 * 避免在已作廢的鏈上留下有效的新 token。回傳有沒有寫入。
 */
export async function rotateOAuthRefreshToken(
  oldTokenHash: string,
  newTokenHash: string,
  newIdleExpiresAt: number,
  DB: D1Database,
): Promise<boolean> {
  const sql = `INSERT INTO oauth_refresh_tokens (token_hash, family_id, client_id, used_at, idle_expires_at, absolute_expires_at)
    SELECT ?, family_id, client_id, NULL, ?, absolute_expires_at
    FROM oauth_refresh_tokens WHERE token_hash = ?
    RETURNING token_hash`
  const row = await DB.prepare(sql).bind(newTokenHash, newIdleExpiresAt, oldTokenHash).first<{ token_hash: string }>()
  return row !== null
}

/**
 * 清理過期資料。已使用的列要留到整條鏈確定失效才能偵測重用，所以只刪絕對上限已過的列
 * （同一條鏈相同，整條一起刪），以及最新一列已閒置過期的整條鏈。
 */
export async function deleteExpiredOAuthRefreshTokens(now: number, DB: D1Database): Promise<void> {
  const deleteAbsoluteExpired = DB.prepare('DELETE FROM oauth_refresh_tokens WHERE absolute_expires_at <= ?').bind(now)
  const deleteIdleExpiredFamilies = DB.prepare(
    `DELETE FROM oauth_refresh_tokens WHERE family_id IN (
      SELECT family_id FROM oauth_refresh_tokens WHERE used_at IS NULL AND idle_expires_at <= ?
    )`,
  ).bind(now)

  await DB.batch([deleteAbsoluteExpired, deleteIdleExpiredFamilies])
}
