import type { InsertAssetParams } from './assetRepository'

/** 檢查 project_assets 是否已存在 (project_id, asset_id) 關聯 */
export async function projectAssetExists(projectId: string, assetId: string, DB: D1Database): Promise<boolean> {
  const sql = 'SELECT 1 FROM project_assets WHERE project_id = ? AND asset_id = ?'
  const row = await DB.prepare(sql).bind(projectId, assetId).first()
  return row !== null
}

/** 匯入既有素材：只新增 project_assets 關聯，不動 assets 本體 */
export async function insertProjectAsset(projectId: string, assetId: string, createdAt: number, DB: D1Database): Promise<void> {
  const sql = 'INSERT INTO project_assets (project_id, asset_id, created_at) VALUES (?, ?, ?)'
  await DB.prepare(sql).bind(projectId, assetId, createdAt).run()
}

/** 整列刪除連同 is_selected 一起消失，選定狀態不必再另外同步清除 */
export async function deleteProjectAsset(projectId: string, assetId: string, DB: D1Database): Promise<void> {
  const sql = 'DELETE FROM project_assets WHERE project_id = ? AND asset_id = ?'
  await DB.prepare(sql).bind(projectId, assetId).run()
}

/** 取得單一專案目前最終選定的素材 id，依 sort_order 排序 */
export async function getSelectedAssetIds(projectId: string, DB: D1Database): Promise<string[]> {
  const sql = `SELECT asset_id FROM project_assets WHERE project_id = ? AND is_selected = 1 ORDER BY sort_order ASC`
  const result = await DB.prepare(sql).bind(projectId).all<{ asset_id: string }>()
  return (result.results ?? []).map((row) => row.asset_id)
}

/** 一次查多個專案已選定的素材 id（依 project_id 分組），避免清單端點對每筆專案各查一次 */
export async function getSelectedAssetIdsByProjectIds(projectIds: string[], DB: D1Database): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (projectIds.length === 0) return map

  const placeholders = projectIds.map(() => '?').join(', ')
  const sql = `SELECT project_id, asset_id FROM project_assets
    WHERE project_id IN (${placeholders}) AND is_selected = 1
    ORDER BY project_id, sort_order ASC`
  const result = await DB.prepare(sql)
    .bind(...projectIds)
    .all<{ project_id: string; asset_id: string }>()

  for (const row of result.results ?? []) {
    const existing = map.get(row.project_id)
    if (existing) existing.push(row.asset_id)
    else map.set(row.project_id, [row.asset_id])
  }
  return map
}

/** 檢查一批 asset_id 是否都存在於該專案的池子，回傳不存在的 id */
export async function findMissingProjectAssetIds(projectId: string, assetIds: string[], DB: D1Database): Promise<string[]> {
  if (assetIds.length === 0) return []

  const placeholders = assetIds.map(() => '?').join(', ')
  const sql = `SELECT asset_id FROM project_assets WHERE project_id = ? AND asset_id IN (${placeholders})`
  const result = await DB.prepare(sql)
    .bind(projectId, ...assetIds)
    .all<{ asset_id: string }>()

  const existing = new Set((result.results ?? []).map((row) => row.asset_id))
  return assetIds.filter((id) => !existing.has(id))
}

/**
 * 先清空該專案所有 is_selected 再依序寫回，兩步包在同一個 batch 內避免中間態；
 * 呼叫前需確認 assetIds 已存在於池子中。
 * 每個 asset 要寫入不同的 sort_order，無法用單一 WHERE id IN (...) 概括，改依 asset_id 分派賦值，
 * 讓 statement 數固定為 2、不隨 assetIds 長度增加。
 */
export async function overwriteSelectedAssets(projectId: string, assetIds: string[], DB: D1Database): Promise<void> {
  const clearSql = 'UPDATE project_assets SET is_selected = 0, sort_order = 0 WHERE project_id = ?'

  if (assetIds.length === 0) {
    await DB.prepare(clearSql).bind(projectId).run()
    return
  }

  const caseClause = assetIds.map(() => 'WHEN ? THEN ?').join(' ')
  const placeholders = assetIds.map(() => '?').join(', ')
  const selectSql = `UPDATE project_assets
    SET is_selected = 1, sort_order = CASE asset_id ${caseClause} END
    WHERE project_id = ? AND asset_id IN (${placeholders})`

  const caseArgs = assetIds.flatMap((assetId, index) => [assetId, index])

  await DB.batch([
    DB.prepare(clearSql).bind(projectId),
    DB.prepare(selectSql).bind(...caseArgs, projectId, ...assetIds),
  ])
}

/**
 * 建立 assets 紀錄、加入 project_assets 池、建立 THUMBNAIL 任務，用 DB.batch 包在同一個交易中。
 * 任務刻意不帶 project_id/user_id，因為 THUMBNAIL 是全域掃描型任務，不需要綁定觸發來源。
 */
export async function insertProjectAssetWithThumbnailTask(asset: InsertAssetParams, taskId: string, DB: D1Database): Promise<void> {
  const insertAssetSql = `INSERT INTO assets (id, extension, type, source_type, source_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  const insertProjectAssetSql = `INSERT INTO project_assets (project_id, asset_id, created_at) VALUES (?, ?, ?)`
  const insertTaskSql = `INSERT INTO tasks (id, type, status, created_at) VALUES (?, 'THUMBNAIL', 'PENDING', ?)`

  await DB.batch([
    DB.prepare(insertAssetSql).bind(asset.id, asset.extension, asset.type, asset.sourceType, asset.sourceId, asset.createdAt),
    DB.prepare(insertProjectAssetSql).bind(asset.sourceId, asset.id, asset.createdAt),
    DB.prepare(insertTaskSql).bind(taskId, asset.createdAt),
  ])
}

export interface DownloadedAssetParams {
  id: string
  extension: string
}

/**
 * 全新產生的 id，不需要檢查重複，單純批次新增即可。
 * 額外固定新增一筆 THUMBNAIL 任務（project_id/user_id 皆為 NULL），寫死在這裡而非交由外部觸發。
 */
export async function insertDownloadedAssetsWithThumbnailTask(
  projectId: string,
  assets: DownloadedAssetParams[],
  thumbnailTaskId: string,
  DB: D1Database,
): Promise<void> {
  const createdAt = Date.now()
  const insertAssetSql = `INSERT INTO assets (id, extension, type, source_type, source_id, created_at) VALUES (?, ?, 'IMAGE', 'PROJECT', ?, ?)`
  const insertProjectAssetSql = `INSERT INTO project_assets (project_id, asset_id, created_at) VALUES (?, ?, ?)`
  const insertTaskSql = `INSERT INTO tasks (id, type, status, created_at) VALUES (?, 'THUMBNAIL', 'PENDING', ?)`

  const statements = assets.flatMap((asset) => [
    DB.prepare(insertAssetSql).bind(asset.id, asset.extension, projectId, createdAt),
    DB.prepare(insertProjectAssetSql).bind(projectId, asset.id, createdAt),
  ])
  statements.push(DB.prepare(insertTaskSql).bind(thumbnailTaskId, createdAt))

  await DB.batch(statements)
}
