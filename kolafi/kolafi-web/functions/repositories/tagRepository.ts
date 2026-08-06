export interface TagRow {
  id: string
  name: string
  is_selected: number
  sort_order: number
  created_at: number
}

export async function listTags(DB: D1Database): Promise<TagRow[]> {
  const sql = 'SELECT id, name, is_selected, sort_order, created_at FROM tags ORDER BY sort_order ASC, created_at DESC'
  const { results } = await DB.prepare(sql).all<TagRow>()
  return results ?? []
}

export async function tagNameExists(name: string, DB: D1Database): Promise<boolean> {
  const sql = 'SELECT 1 FROM tags WHERE name = ?'
  const row = await DB.prepare(sql).bind(name).first()
  return row !== null
}

export async function getNextSortOrder(DB: D1Database): Promise<number> {
  const sql = 'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM tags'
  const row = await DB.prepare(sql).first<{ next: number }>()
  return row?.next ?? 0
}

export async function insertTag(id: string, name: string, sortOrder: number, createdAt: number, DB: D1Database): Promise<void> {
  const sql = 'INSERT INTO tags (id, name, is_selected, sort_order, created_at) VALUES (?, ?, 1, ?, ?)'
  await DB.prepare(sql).bind(id, name, sortOrder, createdAt).run()
}

export async function getTagById(id: string, DB: D1Database): Promise<TagRow | null> {
  const sql = 'SELECT id, name, is_selected, sort_order, created_at FROM tags WHERE id = ?'
  return await DB.prepare(sql).bind(id).first<TagRow>()
}

export async function updateTagSortOrder(id: string, sortOrder: number, DB: D1Database): Promise<void> {
  const sql = 'UPDATE tags SET sort_order = ? WHERE id = ?'
  await DB.prepare(sql).bind(sortOrder, id).run()
}

export async function updateTagIsSelected(id: string, isSelected: boolean, DB: D1Database): Promise<void> {
  const sql = 'UPDATE tags SET is_selected = ? WHERE id = ?'
  await DB.prepare(sql).bind(isSelected ? 1 : 0, id).run()
}

export async function deleteTagById(id: string, DB: D1Database): Promise<void> {
  const sql = 'DELETE FROM tags WHERE id = ?'
  await DB.prepare(sql).bind(id).run()
}
