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

/**
 * 每個 (project_id, user_id) 只保留最新一筆匯出，其餘刪除，回傳刪除筆數。
 * 「最新」的判斷與前端取用方式一致（projectRepository 的 export_url / getLatestExportUrl 都是
 * 依 project_id + user_id 取 created_at 最新一筆）；created_at 相同時以 id 當 tie-breaker 讓結果固定。
 */
export async function deleteSupersededExports(DB: D1Database): Promise<number> {
  const sql = `DELETE FROM project_exports WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY project_id, user_id ORDER BY created_at DESC, id DESC
      ) AS rn
      FROM project_exports
    ) WHERE rn > 1
  )`
  const result = await DB.prepare(sql).run()
  return result.meta?.changes ?? 0
}

export interface ExportRefRow {
  project_id: string
  id: string
}

/** 目前 DB 裡所有匯出（清理舊列之後 = 前端可能存取到的全部匯出），供 worker 比對 R2 物件 */
export async function listAllExportRefs(DB: D1Database): Promise<ExportRefRow[]> {
  const result = await DB.prepare(`SELECT project_id, id FROM project_exports`).all<ExportRefRow>()
  return result.results ?? []
}
