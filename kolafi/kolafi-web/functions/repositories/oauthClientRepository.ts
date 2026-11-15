export interface OAuthClientRow {
  client_id: string
  /** 回呼網址清單，JSON 陣列字串，例如 `["https://a.com/cb","https://b.com/cb"]` */
  redirect_uris: string
}

export async function insertOAuthClient(clientId: string, redirectUrisJson: string, createdAt: number, DB: D1Database): Promise<void> {
  const sql = 'INSERT INTO oauth_clients (client_id, redirect_uris, created_at) VALUES (?, ?, ?)'
  await DB.prepare(sql).bind(clientId, redirectUrisJson, createdAt).run()
}

export async function getOAuthClientById(clientId: string, DB: D1Database): Promise<OAuthClientRow | null> {
  const sql = 'SELECT client_id, redirect_uris FROM oauth_clients WHERE client_id = ?'
  return await DB.prepare(sql).bind(clientId).first<OAuthClientRow>()
}
