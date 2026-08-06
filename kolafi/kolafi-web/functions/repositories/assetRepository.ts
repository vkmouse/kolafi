import type { AssetFilter } from '../utils/validators'

export interface AssetListFilters {
  filter?: AssetFilter
  limit: number
  offset: number
}

export interface AssetListRow {
  id: string
  extension: string
  type: string
  source_type: string
  source_id: string
  created_at: number
  is_used: number
}

const LIST_COLUMNS = 'a.id, a.extension, a.type, a.source_type, a.source_id, a.created_at'
const IS_USED_EXISTS = 'EXISTS (SELECT 1 FROM project_assets pa WHERE pa.asset_id = a.id)'

/**
 * UNUSED 用 NOT EXISTS 篩選（is_used 固定為 0）；IMAGE/VIDEO 用 WHERE a.type = ? 篩選；
 * 其餘情況（含未知值，已在 service 層正規化為 undefined）不篩選，依 created_at 新到舊排序。
 */
export async function listAssets(filters: AssetListFilters, DB: D1Database): Promise<AssetListRow[]> {
  let sql: string
  const args: unknown[] = []

  if (filters.filter === 'UNUSED') {
    sql = `SELECT ${LIST_COLUMNS}, 0 AS is_used
      FROM assets a
      WHERE NOT EXISTS (SELECT 1 FROM project_assets pa WHERE pa.asset_id = a.id)
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?`
  } else if (filters.filter === 'IMAGE' || filters.filter === 'VIDEO') {
    sql = `SELECT ${LIST_COLUMNS}, ${IS_USED_EXISTS} AS is_used
      FROM assets a
      WHERE a.type = ?
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?`
    args.push(filters.filter)
  } else {
    sql = `SELECT ${LIST_COLUMNS}, ${IS_USED_EXISTS} AS is_used
      FROM assets a
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?`
  }

  const result = await DB.prepare(sql)
    .bind(...args, filters.limit, filters.offset)
    .all<AssetListRow>()

  return result.results ?? []
}

export interface AssetStatsRow {
  total: number
  unused: number
  image: number
  video: number
}

/**
 * D1 對 FILTER 子句相容性不穩定，改用 SUM(CASE WHEN ...) 判斷。
 * unused 用 LEFT JOIN 取代逐列相關子查詢；子查詢需先 DISTINCT，
 * 否則素材被多個專案引用時會展開多列，讓 total/image/video 被重複計算。
 */
export async function getAssetStats(DB: D1Database): Promise<AssetStatsRow> {
  const sql = `SELECT
      COUNT(1) AS total,
      SUM(CASE WHEN u.asset_id IS NULL THEN 1 ELSE 0 END) AS unused,
      SUM(CASE WHEN a.type = 'IMAGE' THEN 1 ELSE 0 END) AS image,
      SUM(CASE WHEN a.type = 'VIDEO' THEN 1 ELSE 0 END) AS video
    FROM assets a
    LEFT JOIN (SELECT DISTINCT asset_id FROM project_assets) u ON u.asset_id = a.id`

  const row = await DB.prepare(sql).first<AssetStatsRow>()

  // 沒有任何素材時 SUM 會是 NULL，統一 fallback 成 0
  return {
    total: row?.total ?? 0,
    unused: row?.unused ?? 0,
    image: row?.image ?? 0,
    video: row?.video ?? 0,
  }
}

export interface InsertAssetParams {
  id: string
  extension: string
  type: 'IMAGE' | 'VIDEO'
  sourceType: string
  sourceId: string
  createdAt: number
}

/** 寫入 assets 紀錄並建立 THUMBNAIL 背景任務，包在同一個 DB.batch 交易中，避免中途失敗留下半套資料 */
export async function insertAssetWithThumbnailTask(asset: InsertAssetParams, taskId: string, DB: D1Database): Promise<void> {
  const insertAssetSql = `INSERT INTO assets (id, extension, type, source_type, source_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  const insertTaskSql = `INSERT INTO tasks (id, type, status, created_at) VALUES (?, 'THUMBNAIL', 'PENDING', ?)`

  const insertAsset = DB.prepare(insertAssetSql).bind(asset.id, asset.extension, asset.type, asset.sourceType, asset.sourceId, asset.createdAt)
  const insertTask = DB.prepare(insertTaskSql).bind(taskId, asset.createdAt)

  await DB.batch([insertAsset, insertTask])
}

export interface AssetCoreRow {
  id: string
  extension: string
  type: string
  source_type: string
  source_id: string
  created_at: number
}

export async function getAssetCoreById(assetId: string, DB: D1Database): Promise<AssetCoreRow | null> {
  const sql = `SELECT id, extension, type, source_type, source_id, created_at FROM assets WHERE id = ?`
  return await DB.prepare(sql).bind(assetId).first<AssetCoreRow>()
}

export interface AssetThumbnailRow {
  source_id: string
  has_thumbnail: number
}

/** 只選出組 key 用的 source_id 與判斷是否已產生完成的 has_thumbnail */
export async function getAssetThumbnailInfo(assetId: string, DB: D1Database): Promise<AssetThumbnailRow | null> {
  const sql = `SELECT source_id, has_thumbnail FROM assets WHERE id = ?`
  return await DB.prepare(sql).bind(assetId).first<AssetThumbnailRow>()
}

/** 計算引用此素材的 project_assets 紀錄數，不分專案 */
export async function countProjectAssetUsage(assetId: string, DB: D1Database): Promise<number> {
  const sql = `SELECT COUNT(*) AS count FROM project_assets WHERE asset_id = ?`
  const row = await DB.prepare(sql).bind(assetId).first<{ count: number }>()
  return row?.count ?? 0
}

export async function deleteAssetById(assetId: string, DB: D1Database): Promise<void> {
  await DB.prepare(`DELETE FROM assets WHERE id = ?`).bind(assetId).run()
}

export interface PendingThumbnailAssetRow {
  id: string
  extension: string
  type: string
  source_id: string
  created_at: number
}

/** 全域掃描所有待產生縮圖的素材，不綁定觸發任務當下的那一筆，讓漏掉的素材也能被後續任務補上 */
export async function listAssetsPendingThumbnail(DB: D1Database): Promise<PendingThumbnailAssetRow[]> {
  const sql = `SELECT id, extension, type, source_id, created_at
    FROM assets
    WHERE has_thumbnail = 0
    ORDER BY created_at ASC`
  const result = await DB.prepare(sql).all<PendingThumbnailAssetRow>()
  return result.results ?? []
}

export async function markAssetsThumbnailSuccess(assetIds: string[], DB: D1Database): Promise<void> {
  if (assetIds.length === 0) return
  const placeholders = assetIds.map(() => '?').join(', ')
  const sql = `UPDATE assets SET has_thumbnail = 1 WHERE id IN (${placeholders})`
  await DB.prepare(sql).bind(...assetIds).run()
}

export interface ExportAssetRow {
  id: string
  extension: string
  type: string
  source_id: string
}

/** 傳入的 id 清單可能有重複，這裡只查唯一值並以 Map 回傳，順序與重複交由呼叫端自行還原 */
export async function getAssetsByIds(ids: string[], DB: D1Database): Promise<Map<string, ExportAssetRow>> {
  const uniqueIds = Array.from(new Set(ids))
  if (uniqueIds.length === 0) return new Map()

  const placeholders = uniqueIds.map(() => '?').join(', ')
  const sql = `SELECT id, extension, type, source_id FROM assets WHERE id IN (${placeholders})`
  const result = await DB.prepare(sql)
    .bind(...uniqueIds)
    .all<ExportAssetRow>()

  const map = new Map<string, ExportAssetRow>()
  for (const row of result.results ?? []) map.set(row.id, row)
  return map
}

interface CleanupCandidateRow {
  id: string
  extension: string
  project_id: string
}

export interface PendingCleanupAssetRow {
  id: string
  extension: string
  sourceId: string
}

/**
 * 找出可清理的素材：已發佈專案用過、且全域只被引用一次（故可安全地把該專案當唯一 sourceId）、
 * 且不在該專案目前的最終選定清單內。
 */
export async function listAssetsPendingCleanup(DB: D1Database): Promise<PendingCleanupAssetRow[]> {
  const sql = `SELECT pa.asset_id AS id, a.extension AS extension, pa.project_id AS project_id
    FROM project_assets pa
    JOIN assets a ON a.id = pa.asset_id
    WHERE a.source_type = 'PROJECT'
      AND pa.is_selected = 0
      AND EXISTS (SELECT 1 FROM user_projects up WHERE up.project_id = pa.project_id AND up.status = 'PUBLISHED')
      AND (SELECT COUNT(*) FROM project_assets pa2 WHERE pa2.asset_id = pa.asset_id) = 1
    ORDER BY a.created_at ASC`

  const result = await DB.prepare(sql).all<CleanupCandidateRow>()
  const rows = result.results ?? []
  return rows.map((row) => ({ id: row.id, extension: row.extension, sourceId: row.project_id }))
}

/** Pull 階段已保證引用次數恰好為 1，這裡刪除的 project_assets 是唯一一筆，不影響其他專案 */
export async function deleteAssetsCleanupBatch(assetIds: string[], DB: D1Database): Promise<void> {
  if (assetIds.length === 0) return
  const statements = assetIds.flatMap((id) => [
    DB.prepare(`DELETE FROM project_assets WHERE asset_id = ?`).bind(id),
    DB.prepare(`DELETE FROM assets WHERE id = ?`).bind(id),
  ])
  await DB.batch(statements)
}
