import type { AssetDto, AssetStatsDto, AssetWithUsageDto, Env } from '../types'
import {
  countProjectAssetUsage,
  deleteAssetById,
  getAssetCoreById,
  getAssetStats as getAssetStatsRow,
  insertAssetWithThumbnailTask,
  listAssets,
  type AssetCoreRow,
  type AssetListRow,
} from '../repositories/assetRepository'
import { assetKey, deleteObject, getObject, putObject } from '../utils/storage'
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

/** 縮圖規格沿用舊版地端 worker：長邊 ≤ 320、不放大、JPEG 品質 85、影片取 0.5 秒處的畫面 */
const THUMBNAIL_MAX_SIDE = 320
const THUMBNAIL_QUALITY = 85
const VIDEO_FRAME_TIME = '0.5s'

/**
 * 即時產生縮圖：從 R2 讀原始檔，圖片交給 Cloudflare Images binding、影片交給 Media Transformations binding
 * 轉成 JPEG 後直接回傳。不讀也不寫 R2 的縮圖物件（thumbs/），也不看 has_thumbnail。
 *
 * 需要的 binding：BUCKET（R2，原本就有）、IMAGES、MEDIA。
 * 沒綁定時直接報錯並指出缺哪一個，避免悄悄失敗。
 */
export async function getAssetThumbnail(assetId: string, DB: D1Database, env: Env): Promise<AssetFileResult> {
  const core = await getAssetCoreById(assetId, DB)
  if (!core) {
    return { ok: false, error: '素材不存在', status: 404 }
  }

  const object = await getObject(env, assetKey(core.source_id, core.id, core.extension))
  if (!object) {
    return { ok: false, error: '檔案不存在', status: 404 }
  }

  try {
    if (core.type === 'IMAGE') {
      if (!env.IMAGES) throw new Error('未設定 binding「IMAGES」')

      // anim: false 讓動態 GIF/WebP 只取第一格，跟舊版 PIL 行為一致
      const result = await env.IMAGES.input(object.body)
        .transform({ width: THUMBNAIL_MAX_SIDE, height: THUMBNAIL_MAX_SIDE, fit: 'scale-down' })
        .output({ format: 'image/jpeg', quality: THUMBNAIL_QUALITY, anim: false })

      return { ok: true, body: result.image(), contentType: result.contentType() }
    }

    if (core.type === 'VIDEO') {
      if (!env.MEDIA) throw new Error('未設定 binding「MEDIA」')

      const result = env.MEDIA.input(object.body)
        .transform({ width: THUMBNAIL_MAX_SIDE, height: THUMBNAIL_MAX_SIDE, fit: 'scale-down' })
        .output({ mode: 'frame', time: VIDEO_FRAME_TIME, format: 'jpg' })

      return { ok: true, body: await result.media(), contentType: await result.contentType() }
    }

    return { ok: false, error: `未知素材類型: ${core.type}`, status: 400 }
  } catch (err) {
    // ImagesError / MediaError 帶有數字 code，一併帶出方便對照文件排查
    const code = err instanceof Error && 'code' in err ? ` code=${String((err as { code: unknown }).code)}` : ''
    const reason = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `縮圖轉換失敗 (${core.type} ${core.extension})${code}: ${reason}`, status: 502 }
  }
}
