export interface ProjectTagRow {
  id: string
  project_id: string
  name: string
  is_selected: number
  sort_order: number
  created_at: number
}

export async function listProjectTags(projectId: string, DB: D1Database): Promise<ProjectTagRow[]> {
  const sql = `SELECT id, project_id, name, is_selected, sort_order, created_at FROM project_tags
    WHERE project_id = ?
    ORDER BY sort_order ASC, created_at DESC`
  const { results } = await DB.prepare(sql).bind(projectId).all<ProjectTagRow>()
  return results ?? []
}

/** 名稱重複檢查範圍是單一專案，非全域 */
export async function projectTagNameExists(projectId: string, name: string, DB: D1Database): Promise<boolean> {
  const sql = 'SELECT 1 FROM project_tags WHERE project_id = ? AND name = ?'
  const row = await DB.prepare(sql).bind(projectId, name).first()
  return row !== null
}

export async function getNextProjectTagSortOrder(projectId: string, DB: D1Database): Promise<number> {
  const sql = 'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM project_tags WHERE project_id = ?'
  const row = await DB.prepare(sql).bind(projectId).first<{ next: number }>()
  return row?.next ?? 0
}

export async function insertProjectTag(
  id: string,
  projectId: string,
  name: string,
  sortOrder: number,
  createdAt: number,
  DB: D1Database,
): Promise<void> {
  const sql = 'INSERT INTO project_tags (id, project_id, name, is_selected, sort_order, created_at) VALUES (?, ?, ?, 1, ?, ?)'
  await DB.prepare(sql).bind(id, projectId, name, sortOrder, createdAt).run()
}

/** 查詢條件一併帶上 project_id，避免誤讀到其他專案底下 id 剛好相同的標籤 */
export async function getProjectTagById(id: string, projectId: string, DB: D1Database): Promise<ProjectTagRow | null> {
  const sql = 'SELECT id, project_id, name, is_selected, sort_order, created_at FROM project_tags WHERE id = ? AND project_id = ?'
  return await DB.prepare(sql).bind(id, projectId).first<ProjectTagRow>()
}

export async function updateProjectTagSortOrder(id: string, projectId: string, sortOrder: number, DB: D1Database): Promise<void> {
  const sql = 'UPDATE project_tags SET sort_order = ? WHERE id = ? AND project_id = ?'
  await DB.prepare(sql).bind(sortOrder, id, projectId).run()
}

export async function updateProjectTagIsSelected(id: string, projectId: string, isSelected: boolean, DB: D1Database): Promise<void> {
  const sql = 'UPDATE project_tags SET is_selected = ? WHERE id = ? AND project_id = ?'
  await DB.prepare(sql).bind(isSelected ? 1 : 0, id, projectId).run()
}
