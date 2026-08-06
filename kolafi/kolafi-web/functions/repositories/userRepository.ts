export async function userExists(userId: string, DB: D1Database): Promise<boolean> {
  const sql = 'SELECT 1 FROM users WHERE id = ?'
  const row = await DB.prepare(sql).bind(userId).first()
  return row !== null
}

export interface UserRow {
  id: string
  name: string
}

export async function listUsers(DB: D1Database): Promise<UserRow[]> {
  const sql = 'SELECT id, name FROM users ORDER BY created_at DESC'
  const { results } = await DB.prepare(sql).all<UserRow>()
  return results ?? []
}
