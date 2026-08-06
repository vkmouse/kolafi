/**
 * 六種背景任務（THUMBNAIL/CLEANUP/CAPTION/EXPORT/TAG/DOWNLOAD）的 Pull/Ack 業務邏輯。
 * 這層只負責 D1 溝通；物件儲存的讀寫一律由 Worker 端直接操作，不經過這裡。
 */

import {
  listAssetsPendingThumbnail,
  markAssetsThumbnailSuccess,
  listAssetsPendingCleanup,
  deleteAssetsCleanupBatch,
  getAssetsByIds,
} from '../repositories/assetRepository'
import { findOldestPendingTask, markTaskProcessing, markTaskStatus, getTaskById } from '../repositories/taskRepository'
import { getProjectDetailCore, getProjectNameById, updateUserProjectCaption } from '../repositories/projectRepository'
import { listUserConfigsByUserAndName } from '../repositories/userConfigRepository'
import { insertProjectExport } from '../repositories/exportRepository'
import {
  projectTagNameExists,
  getNextProjectTagSortOrder,
  insertProjectTag,
} from '../repositories/projectTagRepository'
import {
  getSelectedAssetIds,
  insertDownloadedAssetsWithThumbnailTask,
  type DownloadedAssetParams,
} from '../repositories/projectAssetRepository'
import { parseExportParams } from './projectService'
import type { ExportParams } from '../types'

export interface ThumbnailPullAssetDto {
  id: string
  extension: string
  type: string
  sourceId: string
  createdAt: number
}

export interface ThumbnailPullResult {
  taskId: string
  payload: { assets: ThumbnailPullAssetDto[] }
}

/** 回傳全域待處理素材，不只限於觸發這筆任務的那一批，讓漏網的素材也能一併補上 */
export async function pullThumbnailTask(DB: D1Database): Promise<ThumbnailPullResult | null> {
  const task = await findOldestPendingTask('THUMBNAIL', DB)
  if (!task) return null

  await markTaskProcessing(task.id, DB)

  const assets = await listAssetsPendingThumbnail(DB)

  return {
    taskId: task.id,
    payload: {
      assets: assets.map((asset) => ({
        id: asset.id,
        extension: asset.extension,
        type: asset.type,
        sourceId: asset.source_id,
        createdAt: asset.created_at,
      })),
    },
  }
}

export interface ThumbnailAckInput {
  status: 'SUCCESS' | 'FAILED'
  successAssetIds: string[]
  failedAssetIds: string[]
}

/**
 * failedAssetIds 刻意不寫入，讓它們在下一次 Pull 時被自然重新掃到，不需要額外的重試機制。
 * error 訊息不落地，tasks 表沒有對應欄位可存。
 */
export async function ackThumbnailTask(taskId: string, input: ThumbnailAckInput, DB: D1Database): Promise<void> {
  if (input.status === 'FAILED') {
    await markTaskStatus(taskId, 'FAILED', DB)
    return
  }

  if (input.successAssetIds.length > 0) {
    await markAssetsThumbnailSuccess(input.successAssetIds, DB)
  }

  const finalStatus: 'SUCCESS' | 'FAILED' =
    input.successAssetIds.length > 0 || input.failedAssetIds.length === 0 ? 'SUCCESS' : 'FAILED'

  await markTaskStatus(taskId, finalStatus, DB)
}

export interface CleanupPullAssetDto {
  id: string
  extension: string
  sourceId: string
}

export interface CleanupPullResult {
  taskId: string
  payload: { assets: CleanupPullAssetDto[] }
}

/** 全域掃描目前所有可清理的候選素材，不限於觸發這筆任務的那個專案 */
export async function pullCleanupTask(DB: D1Database): Promise<CleanupPullResult | null> {
  const task = await findOldestPendingTask('CLEANUP', DB)
  if (!task) return null

  await markTaskProcessing(task.id, DB)

  const assets = await listAssetsPendingCleanup(DB)

  return {
    taskId: task.id,
    payload: {
      assets: assets.map((asset) => ({
        id: asset.id,
        extension: asset.extension,
        sourceId: asset.sourceId,
      })),
    },
  }
}

export interface CleanupAckInput {
  status: 'SUCCESS' | 'FAILED'
  cleanedAssetIds: string[]
  failedAssetIds: string[]
}

/** failedAssetIds 刻意不寫入，讓下一次 Pull 自然重新掃到 */
export async function ackCleanupTask(taskId: string, input: CleanupAckInput, DB: D1Database): Promise<void> {
  if (input.status === 'FAILED') {
    await markTaskStatus(taskId, 'FAILED', DB)
    return
  }

  if (input.cleanedAssetIds.length > 0) {
    await deleteAssetsCleanupBatch(input.cleanedAssetIds, DB)
  }

  const finalStatus: 'SUCCESS' | 'FAILED' =
    input.cleanedAssetIds.length > 0 || input.failedAssetIds.length === 0 ? 'SUCCESS' : 'FAILED'

  await markTaskStatus(taskId, finalStatus, DB)
}

export interface ExportPullAssetDto {
  id: string
  extension: string
  type: string
  sourceId: string
}

export interface ExportConfigDto {
  id: string
  data: Record<string, unknown>
}

export interface ExportPullResult {
  taskId: string
  payload: {
    /** Worker 直接上傳結果到物件儲存，需要 project_id 組路徑，故額外補上（其餘欄位無法推得此值） */
    projectId: string
    caption: string
    exportParams: ExportParams
    assets: ExportPullAssetDto[]
    bgmConfigs: ExportConfigDto[]
    subtitleConfigs: ExportConfigDto[]
    voiceConfigs: ExportConfigDto[]
    frameConfigs: ExportConfigDto[]
  }
}

/** 非合法 JSON 或非物件時退回空物件，交由呼叫端的預設值合併邏輯接手，不擋掉整個 Pull */
function parseUserConfigData(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/** 要處理哪個使用者、哪個專案由任務建立時寫入的 project_id/user_id 決定，Worker 不需額外提供 */
export async function pullExportTask(DB: D1Database): Promise<ExportPullResult | null> {
  const task = await findOldestPendingTask('EXPORT', DB)
  if (!task) return null

  await markTaskProcessing(task.id, DB)

  const projectId = task.project_id ?? ''
  const userId = task.user_id ?? ''

  const projectDetail = await getProjectDetailCore(projectId, userId, DB)
  const caption = projectDetail?.caption ?? ''
  const exportParams = parseExportParams(projectDetail?.export_params)
  const assetIds = await getSelectedAssetIds(projectId, DB)

  const assetMap = await getAssetsByIds(assetIds, DB)
  const assets: ExportPullAssetDto[] = []
  for (const id of assetIds) {
    const row = assetMap.get(id)
    if (!row) continue // 素材已被刪除，略過
    assets.push({ id: row.id, extension: row.extension, type: row.type, sourceId: row.source_id })
  }

  const [bgmConfigs, subtitleConfigs, voiceConfigs, frameConfigs] = await Promise.all([
    listUserConfigsByUserAndName(userId, 'EXPORT_BGM', DB),
    listUserConfigsByUserAndName(userId, 'EXPORT_SUBTITLE', DB),
    listUserConfigsByUserAndName(userId, 'EXPORT_VOICE', DB),
    listUserConfigsByUserAndName(userId, 'EXPORT_FRAME', DB),
  ])

  const toConfigDtos = (rows: { id: string; data: string }[]): ExportConfigDto[] =>
    rows.map((row) => ({ id: row.id, data: parseUserConfigData(row.data) }))

  return {
    taskId: task.id,
    payload: {
      projectId,
      caption,
      exportParams,
      assets,
      bgmConfigs: toConfigDtos(bgmConfigs),
      subtitleConfigs: toConfigDtos(subtitleConfigs),
      voiceConfigs: toConfigDtos(voiceConfigs),
      frameConfigs: toConfigDtos(frameConfigs),
    },
  }
}

export interface ExportAckInput {
  status: 'SUCCESS' | 'FAILED'
  exportId?: string
}

/**
 * SUCCESS 卻沒帶 exportId 視為請求格式異常，保底當失敗處理。
 * Ack body 沒有 project_id/user_id，需回頭查一次任務本身取得這兩個值。
 *
 * `url` 目前實際下載時不會被讀取（改用 project_id + export_id 現查現組 key），
 * 存這裡純粹是讓 project_exports.url（NOT NULL）有個非空字串。
 */
export async function ackExportTask(taskId: string, input: ExportAckInput, DB: D1Database): Promise<void> {
  if (input.status !== 'SUCCESS' || !input.exportId) {
    await markTaskStatus(taskId, 'FAILED', DB)
    return
  }

  const task = await getTaskById(taskId, DB)
  if (!task || !task.project_id || !task.user_id) {
    // 理論上不會發生：EXPORT 任務建立時一定會帶 project_id/user_id；查不到時保底當作失敗處理，
    // 避免寫入一筆缺少必要欄位的 project_exports。
    await markTaskStatus(taskId, 'FAILED', DB)
    return
  }

  await insertProjectExport(
    {
      id: input.exportId,
      projectId: task.project_id,
      userId: task.user_id,
      url: `/api/exports/${input.exportId}/file`,
      createdAt: Date.now(),
    },
    DB,
  )

  await markTaskStatus(taskId, 'SUCCESS', DB)
}

export interface CaptionPullConfigDto {
  id: string
  path: string
}

export interface CaptionPullResult {
  taskId: string
  payload: {
    projectName: string | null
    captionConfigs: CaptionPullConfigDto[]
  }
}

/** parse 失敗或缺少 path 視為沒有可用路徑，回傳空字串，讓下游依「檔案不存在」規則處理，不中斷整個 Pull */
export async function pullCaptionTask(DB: D1Database): Promise<CaptionPullResult | null> {
  const task = await findOldestPendingTask('CAPTION', DB)
  if (!task) return null

  await markTaskProcessing(task.id, DB)

  const projectName = task.project_id ? await getProjectNameById(task.project_id, DB) : null
  const configRows = task.user_id ? await listUserConfigsByUserAndName(task.user_id, 'CAPTION', DB) : []

  const captionConfigs: CaptionPullConfigDto[] = configRows.map((row) => {
    let path = ''
    try {
      const parsed = JSON.parse(row.data) as { path?: unknown }
      if (typeof parsed.path === 'string') path = parsed.path
    } catch {
      // data 不是合法 JSON 時視為沒有可用路徑，不中斷整個 Pull
    }
    return { id: row.id, path }
  })

  return {
    taskId: task.id,
    payload: { projectName, captionConfigs },
  }
}

export interface CaptionAckInput {
  status: 'SUCCESS' | 'FAILED'
  caption: string
}

/** CAPTION 不區分業務失敗與執行失敗，任何未產出文案的情況一律標記 FAILED，不寫入 caption */
export async function ackCaptionTask(taskId: string, input: CaptionAckInput, DB: D1Database): Promise<void> {
  if (input.status === 'FAILED') {
    await markTaskStatus(taskId, 'FAILED', DB)
    return
  }

  const task = await getTaskById(taskId, DB)
  if (task && task.project_id && task.user_id) {
    await updateUserProjectCaption(task.project_id, task.user_id, input.caption, DB)
  }

  await markTaskStatus(taskId, 'SUCCESS', DB)
}

export interface TagPullResult {
  taskId: string
  payload: { projectName: string | null }
}

/** TAG 只跟 project_id 有關，不需要 user_id（project_tags 不分使用者） */
export async function pullTagTask(DB: D1Database): Promise<TagPullResult | null> {
  const task = await findOldestPendingTask('TAG', DB)
  if (!task) return null

  await markTaskProcessing(task.id, DB)

  const projectName = task.project_id ? await getProjectNameById(task.project_id, DB) : null

  return {
    taskId: task.id,
    payload: { projectName },
  }
}

export interface TagAckInput {
  status: 'SUCCESS' | 'FAILED'
  keywords: string[]
}

/**
 * TAG 不區分業務失敗與執行失敗，未產出關鍵詞時一律標記 FAILED，不寫入 project_tags。
 * 每個關鍵詞的重複檢查與 sort_order 計算彼此有先後依賴（後一筆要看到前一筆剛新增的結果），
 * 因此依序處理，不能整批丟給 db.batch() 一次做完。
 */
export async function ackTagTask(taskId: string, input: TagAckInput, DB: D1Database): Promise<void> {
  if (input.status === 'FAILED') {
    await markTaskStatus(taskId, 'FAILED', DB)
    return
  }

  const task = await getTaskById(taskId, DB)
  if (task && task.project_id) {
    const projectId = task.project_id
    for (const keyword of input.keywords) {
      const exists = await projectTagNameExists(projectId, keyword, DB)
      if (exists) continue

      const sortOrder = await getNextProjectTagSortOrder(projectId, DB)
      await insertProjectTag(crypto.randomUUID(), projectId, keyword, sortOrder, Date.now(), DB)
    }
  }

  await markTaskStatus(taskId, 'SUCCESS', DB)
}

export interface DownloadPullResult {
  taskId: string
  payload: {
    /** Worker 直接上傳下載結果到物件儲存，需要 project_id 組路徑，故額外補上（同 ExportPullResult.payload.projectId） */
    projectId: string | null
    projectName: string | null
  }
}

/** 要搜尋下載的專案由任務建立時寫入的 project_id 決定；下載張數固定 25 張是 Worker 內部值，不透過 Pull 傳遞 */
export async function pullDownloadTask(DB: D1Database): Promise<DownloadPullResult | null> {
  const task = await findOldestPendingTask('DOWNLOAD', DB)
  if (!task) return null

  await markTaskProcessing(task.id, DB)

  const projectName = task.project_id ? await getProjectNameById(task.project_id, DB) : null

  return {
    taskId: task.id,
    payload: { projectId: task.project_id, projectName },
  }
}

export interface DownloadAckAssetDto {
  id: string
  extension: string
}

export interface DownloadAckInput {
  status: 'SUCCESS' | 'FAILED'
  assets: DownloadAckAssetDto[]
}

/**
 * DOWNLOAD 不區分業務失敗與執行失敗，未建立任何素材時一律標記 FAILED。
 * Ack body 沒有 project_id，需回頭查一次任務本身取得。額外固定新增一筆 THUMBNAIL 任務，
 * 回傳的 notifyThumbnail 標記這次是否需要另外通知 THUMBNAIL worker。
 */
export async function ackDownloadTask(taskId: string, input: DownloadAckInput, DB: D1Database): Promise<{ notifyThumbnail: boolean }> {
  if (input.status !== 'SUCCESS' || input.assets.length === 0) {
    await markTaskStatus(taskId, 'FAILED', DB)
    return { notifyThumbnail: false }
  }

  const task = await getTaskById(taskId, DB)
  if (!task || !task.project_id) {
    // 理論上不會發生：DOWNLOAD 任務建立時一定會帶 project_id；查不到時保底當作失敗處理，
    // 避免寫入一批缺少所屬專案的 assets／project_assets。
    await markTaskStatus(taskId, 'FAILED', DB)
    return { notifyThumbnail: false }
  }

  const assets: DownloadedAssetParams[] = input.assets.map((asset) => ({ id: asset.id, extension: asset.extension }))
  await insertDownloadedAssetsWithThumbnailTask(task.project_id, assets, crypto.randomUUID(), DB)

  await markTaskStatus(taskId, 'SUCCESS', DB)
  return { notifyThumbnail: true }
}
