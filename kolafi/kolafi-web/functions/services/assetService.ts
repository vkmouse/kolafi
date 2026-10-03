import type { AssetDto, AssetStatsDto, AssetWithUsageDto, Env } from '../types'
import {
  countProjectAssetUsage,
  deleteAssetById,
  getAssetCoreById,
  getAssetStats as getAssetStatsRow,
  getAssetThumbnailInfo,
  insertAssetWithThumbnailTask,
  listAssets,
  type AssetCoreRow,
  type AssetListRow,
} from '../repositories/assetRepository'
import { assetKey, deleteObject, getObject, putObject, thumbnailKey } from '../utils/storage'
import { mimeTypeByExtension } from '../utils/mime'
import { extractExtension, parseAssetFilter, parsePositiveIntParam, resolveAssetType, type AssetFilter } from '../utils/validators'

export interface ListAssetsQuery {
  filter?: AssetFilter
  page: number
  pageSize: number
}

export function parseListAssetsQuery(searchParams: URLSearchParams): ListAssetsQuery {
  return {
    filter: parseAssetFilter(searchParams.get('filter')),
    page: parsePositiveIntParam(searchParams.get('page'), 1),
    pageSize: parsePositiveIntParam(searchParams.get('page_size'), 50, 100),
  }
}

export interface AssetListResult {
  data: AssetWithUsageDto[]
  hasMore: boolean
  page: number
}

/** 多查一筆用來判斷 has_more，省去多一次 COUNT 查詢 */
export async function getAssetList(query: ListAssetsQuery, DB: D1Database): Promise<AssetListResult> {
  const rows = await listAssets(
    {
      filter: query.filter,
      limit: query.pageSize + 1,
      offset: (query.page - 1) * query.pageSize,
    },
    DB,
  )

  const hasMore = rows.length > query.pageSize
  const pageRows = hasMore ? rows.slice(0, query.pageSize) : rows

  return { data: pageRows.map(rowToUsageDto), hasMore, page: query.page }
}

function rowToDto(row: AssetListRow | AssetCoreRow): AssetDto {
  return {
    id: row.id,
    extension: row.extension,
    type: row.type,
    source_type: row.source_type,
    source_id: row.source_id,
    created_at: row.created_at,
    original_path: `/api/assets/${row.id}/file`,
    thumbnail_path: `/api/assets/${row.id}/thumbnail`,
  }
}

function rowToUsageDto(row: AssetListRow): AssetWithUsageDto {
  return { ...rowToDto(row), is_used: row.is_used === 1 }
}

export async function getAssetStats(DB: D1Database): Promise<AssetStatsDto> {
  const row = await getAssetStatsRow(DB)
  return { total: row.total, unused: row.unused, image: row.image, video: row.video }
}

export type UploadAssetResult = { ok: true; data: AssetDto } | { ok: false; error: string }

/** 依副檔名判斷素材類型，寫入物件儲存與資料庫紀錄，並建立一筆 THUMBNAIL 背景任務供非同步產生縮圖 */
export async function uploadAsset(file: File, DB: D1Database, env: Env): Promise<UploadAssetResult> {
  const extension = extractExtension(file.name)
  const type = resolveAssetType(extension)
  if (!type) {
    return { ok: false, error: `不支援的檔案格式: ${extension}` }
  }

  // 全域上傳固定 source_type = USER、source_id = "USER"
  const sourceType = 'USER'
  const sourceId = 'USER'
  const assetId = crypto.randomUUID()
  const now = Date.now()

  const contentType = file.type || mimeTypeByExtension(extension)
  const key = assetKey(sourceId, assetId, extension)
  await putObject(env, key, file, contentType)

  const taskId = crypto.randomUUID()
  await insertAssetWithThumbnailTask({ id: assetId, extension, type, sourceType, sourceId, createdAt: now }, taskId, DB)

  const core = await getAssetCoreById(assetId, DB)
  if (!core) {
    // 物件儲存與資料庫交易皆已完成，理論上一定查得到；防禦性處理避免型別上出現 undefined
    return { ok: false, error: '素材建立後查詢失敗' }
  }

  // upload 回應的 original_path 固定回傳空字串（其他來源的 AssetDto 都會帶值），是刻意的行為差異，不是遺漏
  return { ok: true, data: { ...rowToDto(core), original_path: '' } }
}

export type DeleteAssetResult = { ok: true } | { ok: false; error: string; status: number }

/** 刪除前需先確認素材存在、且沒有任何 project_assets 紀錄仍引用它 */
export async function deleteAsset(assetId: string, DB: D1Database, env: Env): Promise<DeleteAssetResult> {
  const core = await getAssetCoreById(assetId, DB)
  if (!core) {
    return { ok: false, error: '素材不存在', status: 404 }
  }

  const usageCount = await countProjectAssetUsage(assetId, DB)
  if (usageCount > 0) {
    return { ok: false, error: `無法刪除:此素材正被 ${usageCount} 個專案使用`, status: 400 }
  }

  const key = assetKey(core.source_id, core.id, core.extension)
  await deleteObject(env, key)
  await deleteAssetById(assetId, DB)

  return { ok: true }
}

export type AssetFileResult =
  | { ok: true; body: ReadableStream<Uint8Array>; contentType: string }
  | { ok: false; error: string; status: number }

export async function getAssetFile(assetId: string, DB: D1Database, env: Env): Promise<AssetFileResult> {
  const core = await getAssetCoreById(assetId, DB)
  if (!core) {
    return { ok: false, error: '素材不存在', status: 404 }
  }

  const key = assetKey(core.source_id, core.id, core.extension)
  const object = await getObject(env, key)
  if (!object) {
    return { ok: false, error: '檔案不存在', status: 404 }
  }

  return { ok: true, body: object.body, contentType: mimeTypeByExtension(core.extension) }
}

/** 讀取前需先確認縮圖已產生完成，未完成視為找不到 */
export async function getAssetThumbnail(assetId: string, DB: D1Database, env: Env): Promise<AssetFileResult> {
  const info = await getAssetThumbnailInfo(assetId, DB)
  if (!info) {
    return { ok: false, error: '素材不存在', status: 404 }
  }

  if (info.has_thumbnail !== 1) {
    return { ok: false, error: '縮圖尚未產生', status: 404 }
  }

  const key = thumbnailKey(info.source_id, assetId)
  const object = await getObject(env, key)
  if (!object) {
    return { ok: false, error: '縮圖不存在', status: 404 }
  }

  return { ok: true, body: object.body, contentType: 'image/jpeg' }
}
