import type {
  Env,
  ImportProjectAssetsBody,
  ImportProjectAssetsResultDto,
  ProjectDto,
  SelectProjectAssetsBody,
  UploadedProjectAssetDto,
} from '../types'
import { getAssetCoreById, type InsertAssetParams } from '../repositories/assetRepository'
import {
  deleteProjectAsset,
  getSelectedAssetIds,
  insertProjectAsset,
  insertProjectAssetWithThumbnailTask,
  projectAssetExists,
} from '../repositories/projectAssetRepository'
import { getProjectAfterExportUpdate, projectExists } from '../repositories/projectRepository'
import { applyAssetSelection } from './projectAssetSelectionService'
import { exportUpdateRowToDto } from './projectService'
import { assetKey, putObject } from '../utils/storage'
import { mimeTypeByExtension } from '../utils/mime'
import { extractExtension, isValidUuid, resolveAssetType } from '../utils/validators'

export type ImportProjectAssetsResult = { ok: true; data: ImportProjectAssetsResultDto } | { ok: false; error: string; status: number }

/**
 * POST /api/projects/:project_id/assets — 逐筆匯入既有素材到專案素材池，各自獨立判斷成功或跳過。
 * 沒有包在同一個交易裡：中途若真的發生資料庫錯誤會直接拋出中止，但前面已成功匯入的不會回滾。
 */
export async function importAssetsToProject(
  projectId: string,
  body: ImportProjectAssetsBody,
  DB: D1Database,
): Promise<ImportProjectAssetsResult> {
  if (!Array.isArray(body?.asset_ids) || body.asset_ids.length === 0) {
    return { ok: false, error: '缺少必要欄位: asset_ids', status: 400 }
  }

  if (!(await projectExists(projectId, DB))) {
    return { ok: false, error: '專案不存在', status: 404 }
  }

  const imported: string[] = []
  const skipped: { asset_id: string; reason: string }[] = []
  const now = Date.now()

  for (const raw of body.asset_ids) {
    const assetId = String(raw)

    if (typeof raw !== 'string' || !isValidUuid(assetId)) {
      skipped.push({ asset_id: assetId, reason: '無效的 ID' })
      continue
    }

    if (!(await getAssetCoreById(assetId, DB))) {
      skipped.push({ asset_id: assetId, reason: '素材不存在' })
      continue
    }

    if (await projectAssetExists(projectId, assetId, DB)) {
      skipped.push({ asset_id: assetId, reason: '已經匯入' })
      continue
    }

    await insertProjectAsset(projectId, assetId, now, DB)
    imported.push(assetId)
  }

  return { ok: true, data: { imported, skipped, total: body.asset_ids.length } }
}

export type RemoveAssetResult = { ok: true } | { ok: false; error: string; status: number }

/** DELETE /api/projects/:project_id/assets/:asset_id — 從池子移除；選定狀態同列儲存，一併自動清除 */
export async function removeAssetFromProject(projectId: string, assetId: string, DB: D1Database): Promise<RemoveAssetResult> {
  if (!(await projectAssetExists(projectId, assetId, DB))) {
    return { ok: false, error: '該素材未關聯到此專案', status: 404 }
  }

  await deleteProjectAsset(projectId, assetId, DB)
  return { ok: true }
}

export type UploadProjectAssetResult = { ok: true; data: UploadedProjectAssetDto } | { ok: false; error: string; status: number }

/**
 * POST /api/projects/:project_id/assets/upload — 上傳新檔案並直接建立為專案素材，
 * 同時建立 THUMBNAIL 背景任務。original_path 此端點固定回傳空字串。
 */
export async function uploadAssetToProject(
  projectId: string,
  file: File,
  DB: D1Database,
  env: Env,
): Promise<UploadProjectAssetResult> {
  if (!(await projectExists(projectId, DB))) {
    return { ok: false, error: '專案不存在', status: 404 }
  }

  const extension = extractExtension(file.name)
  const type = resolveAssetType(extension)
  if (!type) {
    return { ok: false, error: `不支援的檔案格式: ${extension}`, status: 400 }
  }

  const assetId = crypto.randomUUID()
  const now = Date.now()
  const contentType = file.type || mimeTypeByExtension(extension)

  // source_type 固定為 PROJECT、source_id 為 project_id
  const key = assetKey(projectId, assetId, extension)
  await putObject(env, key, file, contentType)

  const asset: InsertAssetParams = { id: assetId, extension, type, sourceType: 'PROJECT', sourceId: projectId, createdAt: now }
  await insertProjectAssetWithThumbnailTask(asset, crypto.randomUUID(), DB)

  const core = await getAssetCoreById(assetId, DB)
  if (!core) {
    // 物件儲存與資料庫交易皆已完成，理論上一定查得到；防禦性處理避免型別上出現 undefined
    return { ok: false, error: '素材建立後查詢失敗', status: 500 }
  }

  return {
    ok: true,
    data: {
      id: core.id,
      extension: core.extension,
      type: core.type,
      source_type: core.source_type,
      source_id: core.source_id,
      created_at: new Date(core.created_at).toISOString(),
      original_path: '',
      thumbnail_path: `/api/assets/${core.id}/thumbnail`,
    },
  }
}

export type SelectProjectAssetsResult = { ok: true; data: ProjectDto } | { ok: false; error: string; status: number }

/**
 * PUT /api/projects/:project_id/assets/select — 整批覆蓋專案最終選定清單。
 * 非法 UUID 靜默捨棄；合法但不在池子裡的 id 會擋下整個請求回 400（需先匯入）。
 * 回應只有 id/name/asset_ids/export_params 是真實值，其餘為零值，同匯出參數更新端點。
 */
export async function selectProjectAssets(
  projectId: string,
  userId: string,
  body: SelectProjectAssetsBody,
  DB: D1Database,
): Promise<SelectProjectAssetsResult> {
  if (!Array.isArray(body?.asset_ids)) {
    return { ok: false, error: '缺少必要欄位: asset_ids', status: 400 }
  }

  if (!(await projectExists(projectId, DB))) {
    return { ok: false, error: '專案不存在', status: 404 }
  }

  const assetIds = body.asset_ids.filter((id: unknown): id is string => typeof id === 'string' && isValidUuid(id))

  const applyResult = await applyAssetSelection(projectId, assetIds, DB)
  if (!applyResult.ok) {
    return applyResult
  }

  const row = await getProjectAfterExportUpdate(projectId, userId, DB)
  if (!row) {
    return { ok: false, error: '專案更新後查詢失敗', status: 500 }
  }

  const selectedAssetIds = await getSelectedAssetIds(projectId, DB)
  return { ok: true, data: exportUpdateRowToDto(row, selectedAssetIds) }
}
