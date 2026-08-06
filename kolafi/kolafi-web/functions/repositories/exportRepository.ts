export async function getExportProjectId(exportId: string, DB: D1Database): Promise<string | null> {
  const sql = `SELECT project_id FROM project_exports WHERE id = ?`
  const row = await DB.prepare(sql).bind(exportId).first<{ project_id: string }>()
  return row?.project_id ?? null
}

export interface InsertProjectExportParams {
  id: string
  projectId: string
  userId: string
  url: string
  createdAt: number
}

export async function insertProjectExport(params: InsertProjectExportParams, DB: D1Database): Promise<void> {
  const sql = `INSERT INTO project_exports (id, project_id, user_id, url, created_at) VALUES (?, ?, ?, ?, ?)`
  await DB.prepare(sql).bind(params.id, params.projectId, params.userId, params.url, params.createdAt).run()
}
