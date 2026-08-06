export interface ProjectListFilters {
  userId: string
  status?: string
  search?: string
  sort: 'asc' | 'desc'
  limit: number
  offset: number
}

export interface ProjectListRow {
  id: string
  name: string
  created_at: number
  status: string
  caption: string
  export_params: string
  export_url: string | null
  has_active_task: number
}

function buildFilterClause(filters: Pick<ProjectListFilters, 'status' | 'search'>): {
  clause: string
  args: unknown[]
} {
  const conditions: string[] = []
  const args: unknown[] = []

  if (filters.status) {
    conditions.push('up.status = ?')
    args.push(filters.status)
  }
  if (filters.search) {
    // LIKE 對 ASCII 不分大小寫，中文等非 ASCII 字元本無大小寫之分，不需要額外處理
    conditions.push('p.name LIKE ?')
    args.push(`%${filters.search}%`)
  }

  return {
    clause: conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '',
    args,
  }
}

export async function countProjects(filters: Pick<ProjectListFilters, 'userId' | 'status' | 'search'>, DB: D1Database): Promise<number> {
  const { clause, args } = buildFilterClause(filters)

  const sql = `SELECT COUNT(1) AS total
    FROM projects p
    JOIN user_projects up ON p.id = up.project_id AND up.user_id = ?
    WHERE 1 = 1${clause}`

  const row = await DB.prepare(sql)
    .bind(filters.userId, ...args)
    .first<{ total: number }>()

  return row?.total ?? 0
}

/**
 * export_url 用相關子查詢取最新一筆匯出網址（SQLite 不支援 LATERAL JOIN）。
 * has_active_task：DOWNLOAD/TAG 任務不分使用者皆可見，CAPTION/EXPORT 只算本人觸發的。
 */
export async function listProjects(filters: ProjectListFilters, DB: D1Database): Promise<ProjectListRow[]> {
  const { clause, args } = buildFilterClause(filters)
  const sortDirection = filters.sort === 'asc' ? 'ASC' : 'DESC'

  const sql = `SELECT
      p.id,
      p.name,
      p.created_at,
      up.status,
      up.caption,
      up.export_params,
      (
        SELECT pe.url
        FROM project_exports pe
        WHERE pe.project_id = p.id AND pe.user_id = up.user_id
        ORDER BY pe.created_at DESC
        LIMIT 1
      ) AS export_url,
      EXISTS (
        SELECT 1
        FROM tasks t
        WHERE t.project_id = p.id
          AND t.status IN ('PENDING', 'PROCESSING')
          AND (
            t.type IN ('DOWNLOAD', 'TAG')
            OR (t.type IN ('CAPTION', 'EXPORT') AND t.user_id = up.user_id)
          )
      ) AS has_active_task
    FROM projects p
    JOIN user_projects up ON p.id = up.project_id AND up.user_id = ?
    WHERE 1 = 1${clause}
    ORDER BY p.created_at ${sortDirection}
    LIMIT ? OFFSET ?`

  const result = await DB.prepare(sql)
    .bind(filters.userId, ...args, filters.limit, filters.offset)
    .all<ProjectListRow>()

  return result.results ?? []
}

/** 對 users 表中每一個使用者各自新增一筆 user_projects 關聯，非只有發出請求的那位 */
export async function insertProjectForAllUsers(
  params: {
    projectId: string
    name: string
    exportParamsJson: string
    createdAt: number
  },
  DB: D1Database,
): Promise<void> {
  const insertProjectSql = `INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)`
  const insertUserProjectsSql = `INSERT INTO user_projects (user_id, project_id, caption, export_params, created_at)
    SELECT id, ?, '', ?, ? FROM users`

  const insertProject = DB.prepare(insertProjectSql).bind(params.projectId, params.name, params.createdAt)
  const insertUserProjects = DB.prepare(insertUserProjectsSql).bind(params.projectId, params.exportParamsJson, params.createdAt)

  // batch 會將多個陳述式包在同一個交易中執行，任一失敗則全部不生效
  await DB.batch([insertProject, insertUserProjects])
}

export interface ProjectStatsRow {
  total_count: number
  draft_count: number
  pending_count: number
  published_count: number
}

/** 依 user_projects.status 分組計數；FILTER 子句在 D1 相容性不如 SUM(CASE WHEN ...) 穩定 */
export async function getProjectStats(userId: string, DB: D1Database): Promise<ProjectStatsRow> {
  const sql = `SELECT
      COUNT(1) AS total_count,
      SUM(CASE WHEN up.status = 'DRAFT' THEN 1 ELSE 0 END) AS draft_count,
      SUM(CASE WHEN up.status = 'PENDING' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN up.status = 'PUBLISHED' THEN 1 ELSE 0 END) AS published_count
    FROM projects p
    JOIN user_projects up ON p.id = up.project_id
    WHERE up.user_id = ?`

  const row = await DB.prepare(sql)
    .bind(userId)
    .first<ProjectStatsRow>()

  // 沒有任何專案時 SUM 會是 NULL，統一 fallback 成 0
  return {
    total_count: row?.total_count ?? 0,
    draft_count: row?.draft_count ?? 0,
    pending_count: row?.pending_count ?? 0,
    published_count: row?.published_count ?? 0,
  }
}

/** 只取 name，查無此專案回傳 null 而非拋錯 */
export async function getProjectNameById(projectId: string, DB: D1Database): Promise<string | null> {
  const sql = 'SELECT name FROM projects WHERE id = ?'
  const row = await DB.prepare(sql).bind(projectId).first<{ name: string }>()
  return row?.name ?? null
}

export async function getProjectCoreById(
  projectId: string,
  DB: D1Database,
): Promise<{ id: string; name: string; created_at: number } | null> {
  const sql = `SELECT id, name, created_at FROM projects WHERE id = ?`

  return await DB.prepare(sql)
    .bind(projectId)
    .first<{ id: string; name: string; created_at: number }>()
}

/** 第 2 層專案存取驗證用：確認 user_projects 中是否存在 (user_id, project_id) 關聯 */
export async function userHasProjectAccess(userId: string, projectId: string, DB: D1Database): Promise<boolean> {
  const sql = 'SELECT 1 FROM user_projects WHERE user_id = ? AND project_id = ?'

  const row = await DB.prepare(sql)
    .bind(userId, projectId)
    .first()
  return row !== null
}

export interface ProjectDetailCoreRow {
  id: string
  name: string
  created_at: number
  status: string
  caption: string
  export_params: string
}

export async function getProjectDetailCore(
  projectId: string,
  userId: string,
  DB: D1Database,
): Promise<ProjectDetailCoreRow | null> {
  const sql = `SELECT p.id, p.name, p.created_at, up.status, up.caption, up.export_params
    FROM projects p
    JOIN user_projects up ON p.id = up.project_id
    WHERE p.id = ? AND up.user_id = ?`

  return await DB.prepare(sql)
    .bind(projectId, userId)
    .first<ProjectDetailCoreRow>()
}

export async function getLatestExportUrl(projectId: string, userId: string, DB: D1Database): Promise<string | null> {
  const sql = `SELECT url FROM project_exports
    WHERE project_id = ? AND user_id = ?
    ORDER BY created_at DESC LIMIT 1`

  const row = await DB.prepare(sql)
    .bind(projectId, userId)
    .first<{ url: string }>()
  return row?.url ?? null
}

export interface ProjectAssetRow {
  id: string
  extension: string
  type: string
  source_type: string
  source_id: string
  created_at: number
  added_at: number
}

/** 依「加入專案的時間」（project_assets.created_at）新到舊排序 */
export async function getProjectAssets(projectId: string, DB: D1Database): Promise<ProjectAssetRow[]> {
  const sql = `SELECT a.id, a.extension, a.type, a.source_type, a.source_id, a.created_at, pa.created_at AS added_at
    FROM assets a
    JOIN project_assets pa ON a.id = pa.asset_id
    WHERE pa.project_id = ?
    ORDER BY pa.created_at DESC`

  const result = await DB.prepare(sql)
    .bind(projectId)
    .all<ProjectAssetRow>()
  return result.results ?? []
}

/** 只檢查 projects 表本身是否存在此 id（不 join user_projects），供 name 更新／刪除端點使用 */
export async function projectExists(projectId: string, DB: D1Database): Promise<boolean> {
  const sql = 'SELECT 1 FROM projects WHERE id = ?'
  const row = await DB.prepare(sql).bind(projectId).first()
  return row !== null
}

/** 更新全域欄位 projects.name（不分使用者，所有人看到的名稱都會變） */
export async function updateProjectName(projectId: string, name: string, DB: D1Database): Promise<void> {
  const sql = 'UPDATE projects SET name = ? WHERE id = ?'
  await DB.prepare(sql).bind(name, projectId).run()
}

export interface ProjectNameUpdateRow {
  id: string
  name: string
  created_at: number
  export_params: string
}

/** 名稱更新後重新查詢，刻意不選取 status/caption */
export async function getProjectAfterNameUpdate(
  projectId: string,
  userId: string,
  DB: D1Database,
): Promise<ProjectNameUpdateRow | null> {
  const sql = `SELECT p.id, p.name, p.created_at, up.export_params
    FROM projects p
    JOIN user_projects up ON p.id = up.project_id
    WHERE p.id = ? AND up.user_id = ?`

  return await DB.prepare(sql)
    .bind(projectId, userId)
    .first<ProjectNameUpdateRow>()
}

/** 更新個人欄位 user_projects.status（只影響目前使用者自己看到的狀態） */
export async function updateUserProjectStatus(
  projectId: string,
  userId: string,
  status: string,
  DB: D1Database,
): Promise<void> {
  const sql = 'UPDATE user_projects SET status = ? WHERE project_id = ? AND user_id = ?'
  await DB.prepare(sql)
    .bind(status, projectId, userId)
    .run()
}

export interface ProjectStatusUpdateRow {
  id: string
  name: string
  created_at: number
  status: string
  export_params: string
}

/** 狀態更新後重新查詢，刻意不選取 caption */
export async function getProjectAfterStatusUpdate(
  projectId: string,
  userId: string,
  DB: D1Database,
): Promise<ProjectStatusUpdateRow | null> {
  const sql = `SELECT p.id, p.name, p.created_at, up.status, up.export_params
    FROM projects p
    JOIN user_projects up ON p.id = up.project_id
    WHERE p.id = ? AND up.user_id = ?`

  return await DB.prepare(sql)
    .bind(projectId, userId)
    .first<ProjectStatusUpdateRow>()
}

/**
 * 更新個人欄位 user_projects.caption（只影響目前使用者自己的文案）。
 * 刻意不事先檢查 (user_id, project_id) 關聯是否存在：UPDATE 影響 0 筆不視為錯誤。
 */
export async function updateUserProjectCaption(
  projectId: string,
  userId: string,
  caption: string,
  DB: D1Database,
): Promise<void> {
  const sql = 'UPDATE user_projects SET caption = ? WHERE user_id = ? AND project_id = ?'
  await DB.prepare(sql)
    .bind(caption, userId, projectId)
    .run()
}

export interface UserProjectExportParamsRow {
  export_params: string
}

/** PUT /api/projects/:project_id/export 更新前先取得現有的 export_params，供部分更新合併用 */
export async function getUserProjectExportParams(
  projectId: string,
  userId: string,
  DB: D1Database,
): Promise<UserProjectExportParamsRow | null> {
  const sql = `SELECT up.export_params
    FROM projects p
    JOIN user_projects up ON p.id = up.project_id
    WHERE p.id = ? AND up.user_id = ?`

  return await DB.prepare(sql)
    .bind(projectId, userId)
    .first<UserProjectExportParamsRow>()
}

/** 更新個人欄位 user_projects.export_params（只影響目前使用者自己的匯出參數） */
export async function updateUserProjectExportParams(
  projectId: string,
  userId: string,
  exportParamsJson: string,
  DB: D1Database,
): Promise<void> {
  const sql = 'UPDATE user_projects SET export_params = ? WHERE project_id = ? AND user_id = ?'
  await DB.prepare(sql)
    .bind(exportParamsJson, projectId, userId)
    .run()
}

export interface ProjectExportUpdateRow {
  id: string
  name: string
  export_params: string
}

/** 匯出參數更新後重新查詢，刻意只選取 id/name/export_params，其餘欄位固定回退為零值 */
export async function getProjectAfterExportUpdate(
  projectId: string,
  userId: string,
  DB: D1Database,
): Promise<ProjectExportUpdateRow | null> {
  const sql = `SELECT p.id, p.name, up.export_params
    FROM projects p
    JOIN user_projects up ON p.id = up.project_id
    WHERE p.id = ? AND up.user_id = ?`

  return await DB.prepare(sql)
    .bind(projectId, userId)
    .first<ProjectExportUpdateRow>()
}

// 依外鍵順序排列，確保刪除時不違反外鍵約束
const CASCADE_DELETE_SQL = [
  'DELETE FROM project_tags WHERE project_id = ?',
  'DELETE FROM project_exports WHERE project_id = ?',
  'DELETE FROM tasks WHERE project_id = ?',
  'DELETE FROM project_assets WHERE project_id = ?',
  "DELETE FROM assets WHERE source_type = 'PROJECT' AND source_id = ?",
  'DELETE FROM user_projects WHERE project_id = ?',
  'DELETE FROM projects WHERE id = ?',
]

/** 刪除專案及所有關聯資料，用 DB.batch 包在同一個交易中執行，任一陳述式失敗則全部不生效 */
export async function deleteProjectCascade(projectId: string, DB: D1Database): Promise<void> {
  await DB.batch(CASCADE_DELETE_SQL.map((sql) => DB.prepare(sql).bind(projectId)))
}
