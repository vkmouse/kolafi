import type {
  CreateProjectBody,
  Env,
  ExportParams,
  Pagination,
  ProjectAssetDto,
  ProjectDetailDto,
  ProjectDto,
  ProjectStatsDto,
  UpdateProjectCaptionBody,
  UpdateProjectExportBody,
  UpdateProjectNameBody,
  UpdateProjectStatusBody,
} from '../types'
import {
  countProjects,
  deleteProjectCascade,
  getLatestExportUrl,
  getProjectAfterExportUpdate,
  getProjectAfterNameUpdate,
  getProjectAfterStatusUpdate,
  getUserProjectExportParams,
  getProjectAssets,
  getProjectCoreById,
  getProjectDetailCore,
  getProjectStats as getProjectStatsRow,
  insertProjectForAllUsers,
  listProjects,
  projectExists,
  updateProjectName as updateProjectNameRow,
  updateUserProjectCaption,
  updateUserProjectExportParams,
  updateUserProjectStatus,
  userHasProjectAccess,
  type ProjectAssetRow,
  type ProjectDetailCoreRow,
  type ProjectExportUpdateRow,
  type ProjectListRow,
  type ProjectNameUpdateRow,
  type ProjectStatusUpdateRow,
} from '../repositories/projectRepository'
import { getSelectedAssetIds, getSelectedAssetIdsByProjectIds } from '../repositories/projectAssetRepository'
import { applyAssetSelection } from './projectAssetSelectionService'
import { assetsPrefixForSource, deleteByPrefix, exportsPrefixForProject, thumbsPrefixForSource } from '../utils/storage'
import {
  isNonEmptyString,
  isValidProjectStatus,
  isValidUuid,
  ALLOWED_PROJECT_STATUSES,
  parsePositiveIntParam,
  parseSortParam,
  parseStatusFilter,
} from '../utils/validators'

const DEFAULT_EXPORT_PARAMS: ExportParams = {
  resolution: '1080x1920',
  video_duration: 10.0,
  total_duration: 17.0,
}

export interface ListProjectsQuery {
  status?: string
  search?: string
  sort: 'asc' | 'desc'
  page: number
  pageSize: number
}

export function parseListProjectsQuery(searchParams: URLSearchParams): ListProjectsQuery {
  return {
    status: parseStatusFilter(searchParams.get('status')),
    search: searchParams.get('search') || undefined,
    sort: parseSortParam(searchParams.get('sort')),
    page: parsePositiveIntParam(searchParams.get('page'), 1),
    pageSize: parsePositiveIntParam(searchParams.get('page_size'), 50, 100),
  }
}

export async function getProjectList(
  userId: string,
  query: ListProjectsQuery,
  DB: D1Database,
): Promise<{ data: ProjectDto[]; pagination: Pagination }> {
  const filterArgs = { userId, status: query.status, search: query.search }

  const total = await countProjects(filterArgs, DB)

  const rows = await listProjects(
    {
      ...filterArgs,
      sort: query.sort,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    },
    DB,
  )

  // total 為 0 時仍固定回傳 1 頁，而非 0
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize))

  // 一次查完這一頁所有專案已選定的素材 id，避免對每筆專案各查一次（N+1）
  const assetIdsMap = await getSelectedAssetIdsByProjectIds(rows.map((row) => row.id), DB)

  return {
    data: rows.map((row) => rowToDto(row, assetIdsMap.get(row.id) ?? [])),
    pagination: { page: query.page, page_size: query.pageSize, total, total_pages: totalPages },
  }
}

function rowToDto(row: ProjectListRow, assetIds: string[]): ProjectDto {
  const dto: ProjectDto = {
    id: row.id,
    name: row.name,
    export_params: parseExportParams(row.export_params),
    asset_ids: assetIds,
    caption: row.caption,
    status: row.status,
    has_active_task: row.has_active_task === 1,
    created_at: new Date(row.created_at).toISOString(),
  }

  // 從未匯出過則不出現在回應中（omitempty）
  if (row.export_url) {
    dto.export_url = row.export_url
  }

  return dto
}

export function parseExportParams(raw: string | null | undefined): ExportParams {
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (isNonEmptyString(parsed?.resolution)) {
        return {
          resolution: parsed.resolution,
          video_duration: parsed.video_duration,
          total_duration: parsed.total_duration,
        }
      }
    } catch {
      // 非合法 JSON 視同未設定，回退系統預設值
    }
  }
  return { ...DEFAULT_EXPORT_PARAMS }
}

export async function getProjectStats(userId: string, DB: D1Database): Promise<ProjectStatsDto> {
  const row = await getProjectStatsRow(userId, DB)

  return {
    total: row.total_count,
    draft: row.draft_count,
    pending: row.pending_count,
    published: row.published_count,
  }
}

/** null 代表查無此 project_id / user_id 對應的 user_projects 關聯（理論上已被第 2 層驗證擋下，這裡是防禦性處理） */
export async function getProjectDetail(userId: string, projectId: string, DB: D1Database): Promise<ProjectDetailDto | null> {
  const core = await getProjectDetailCore(projectId, userId, DB)
  if (!core) return null

  const [exportUrl, assetRows, selectedAssetIds] = await Promise.all([
    getLatestExportUrl(projectId, userId, DB),
    getProjectAssets(projectId, DB),
    getSelectedAssetIds(projectId, DB),
  ])

  const dto: ProjectDetailDto = {
    id: core.id,
    name: core.name,
    export_params: parseExportParamsNoDefault(core.export_params),
    asset_ids: selectedAssetIds,
    caption: core.caption,
    status: core.status,
    created_at: new Date(core.created_at).toISOString(),
    assets: assetRows.map(rowToAssetDto),
  }

  if (exportUrl) {
    dto.export_url = exportUrl
  }

  return dto
}

/** 跟清單端點的 parseExportParams 不同：這裡沒有系統預設值回退，缺欄位一律補零值，非「未設定就套用系統預設」 */
function parseExportParamsNoDefault(raw: string | null | undefined): ExportParams {
  let parsed: Partial<ExportParams> = {}
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = {}
    }
  }
  return {
    resolution: typeof parsed.resolution === 'string' ? parsed.resolution : '',
    video_duration: typeof parsed.video_duration === 'number' ? parsed.video_duration : 0,
    total_duration: typeof parsed.total_duration === 'number' ? parsed.total_duration : 0,
  }
}

export type ProjectMutationResult = { ok: true; data: ProjectDto } | { ok: false; error: string; status: number }

/** name 更新回應只含部分欄位；status/caption 未被查詢語句選取，固定回退為零值空字串 */
function nameUpdateRowToDto(row: ProjectNameUpdateRow, assetIds: string[]): ProjectDto {
  return {
    id: row.id,
    name: row.name,
    export_params: parseExportParamsNoDefault(row.export_params),
    asset_ids: assetIds,
    caption: '',
    status: '',
    has_active_task: false,
    created_at: new Date(row.created_at).toISOString(),
  }
}

/** PUT /api/projects/:project_id/name — 更新全域欄位 projects.name */
export async function updateProjectName(
  projectId: string,
  userId: string,
  body: UpdateProjectNameBody,
  DB: D1Database,
): Promise<ProjectMutationResult> {
  if (!isNonEmptyString(body?.name)) {
    return { ok: false, error: '缺少必要欄位: name', status: 400 }
  }

  const name = body.name.trim()
  if (!name) {
    return { ok: false, error: '專案名稱不能為空', status: 400 }
  }

  // 只檢查 projects 表本身，不像狀態更新那樣額外 join user_projects 確認關聯
  const exists = await projectExists(projectId, DB)
  if (!exists) {
    return { ok: false, error: '專案不存在', status: 404 }
  }

  await updateProjectNameRow(projectId, name, DB)

  const row = await getProjectAfterNameUpdate(projectId, userId, DB)
  if (!row) {
    return { ok: false, error: '專案更新後查詢失敗', status: 500 }
  }

  const assetIds = await getSelectedAssetIds(projectId, DB)
  return { ok: true, data: nameUpdateRowToDto(row, assetIds) }
}

/** status 更新回應含 status，但不含 caption（未被查詢語句選取，固定回退為零值空字串） */
function statusUpdateRowToDto(row: ProjectStatusUpdateRow, assetIds: string[]): ProjectDto {
  return {
    id: row.id,
    name: row.name,
    export_params: parseExportParamsNoDefault(row.export_params),
    asset_ids: assetIds,
    caption: '',
    status: row.status,
    has_active_task: false,
    created_at: new Date(row.created_at).toISOString(),
  }
}

/** PUT /api/projects/:project_id/status — 更新個人欄位 user_projects.status */
export async function updateProjectStatus(
  projectId: string,
  userId: string,
  body: UpdateProjectStatusBody,
  DB: D1Database,
): Promise<ProjectMutationResult> {
  if (!isNonEmptyString(body?.status)) {
    return { ok: false, error: '缺少必要欄位: status', status: 400 }
  }

  const status = body.status.trim()
  if (!isValidProjectStatus(status)) {
    return {
      ok: false,
      error: `無效的狀態值，允許的值為: ${ALLOWED_PROJECT_STATUSES.join(', ')}`,
      status: 400,
    }
  }

  // 確認 (user_id, project_id) 關聯存在；此端點已過第 2 層驗證，這裡是防禦性重複檢查
  const hasAccess = await userHasProjectAccess(userId, projectId, DB)
  if (!hasAccess) {
    return { ok: false, error: '專案不存在或無權限訪問', status: 404 }
  }

  await updateUserProjectStatus(projectId, userId, status, DB)

  const row = await getProjectAfterStatusUpdate(projectId, userId, DB)
  if (!row) {
    return { ok: false, error: '專案更新後查詢失敗', status: 500 }
  }

  const assetIds = await getSelectedAssetIds(projectId, DB)
  return { ok: true, data: statusUpdateRowToDto(row, assetIds) }
}

/** caption 更新回應同時含 status 與 caption（三個更新端點中唯一同時選取兩者的一個） */
function captionUpdateRowToDto(row: ProjectDetailCoreRow, assetIds: string[]): ProjectDto {
  return {
    id: row.id,
    name: row.name,
    export_params: parseExportParamsNoDefault(row.export_params),
    asset_ids: assetIds,
    caption: row.caption,
    status: row.status,
    has_active_task: false,
    created_at: new Date(row.created_at).toISOString(),
  }
}

/** PUT /api/projects/:project_id/caption — 更新個人欄位 user_projects.caption */
export async function updateProjectCaption(
  projectId: string,
  userId: string,
  body: UpdateProjectCaptionBody,
  DB: D1Database,
): Promise<ProjectMutationResult> {
  // caption 不能是空字串——傳空字串一律視為「未填」，不區分「欄位不存在」與「欄位為空字串」
  if (!isNonEmptyString(body?.caption)) {
    return { ok: false, error: '缺少必要欄位: caption', status: 400 }
  }

  // 刻意不事先檢查 (user_id, project_id) 關聯是否存在：UPDATE 影響 0 筆不視為錯誤
  await updateUserProjectCaption(projectId, userId, body.caption, DB)

  const row = await getProjectDetailCore(projectId, userId, DB)
  if (!row) {
    return { ok: false, error: '專案更新後查詢失敗', status: 500 }
  }

  const assetIds = await getSelectedAssetIds(projectId, DB)
  return { ok: true, data: captionUpdateRowToDto(row, assetIds) }
}

/**
 * 匯出參數更新回應刻意只含 id/name/export_params/asset_ids，其餘欄位（caption/status/has_active_task/created_at）
 * 固定回退為零值，query 本身未選取這些欄位。
 */
export function exportUpdateRowToDto(row: ProjectExportUpdateRow, assetIds: string[]): ProjectDto {
  return {
    id: row.id,
    name: row.name,
    export_params: parseExportParamsNoDefault(row.export_params),
    asset_ids: assetIds,
    caption: '',
    status: '',
    has_active_task: false,
    created_at: '0001-01-01T00:00:00Z',
  }
}

/**
 * PUT /api/projects/:project_id/export — 更新個人欄位 user_projects.export_params，
 * 若有帶 asset_ids 則另外整批覆蓋最終選定清單。所有欄位皆為可選、部分更新語意：
 * 只有請求中真的帶了該欄位（型別符合、且不是 null/undefined）才會覆蓋，其餘保留原值。
 */
export async function updateProjectExport(
  projectId: string,
  userId: string,
  body: UpdateProjectExportBody,
  DB: D1Database,
): Promise<ProjectMutationResult> {
  const current = await getUserProjectExportParams(projectId, userId, DB)
  if (!current) {
    return { ok: false, error: '專案不存在', status: 404 }
  }

  const exportParams = parseExportParamsNoDefault(current.export_params)

  // 只檢查型別是否吻合（字串/數字），不檢查是否為空字串/0——帶了欄位就覆蓋，即使值是空字串或 0
  if (typeof body?.resolution === 'string') {
    exportParams.resolution = body.resolution
  }
  if (typeof body?.video_duration === 'number') {
    exportParams.video_duration = body.video_duration
  }
  if (typeof body?.total_duration === 'number') {
    exportParams.total_duration = body.total_duration
  }

  // 帶了 asset_ids（即使是空陣列）就整批覆蓋最終選定清單；沒帶就不動；id 若不在池子裡會回 400
  if (Array.isArray(body?.asset_ids)) {
    const assetIds = body.asset_ids.filter((id: unknown): id is string => typeof id === 'string' && isValidUuid(id))
    const applyResult = await applyAssetSelection(projectId, assetIds, DB)
    if (!applyResult.ok) {
      return applyResult
    }
  }

  await updateUserProjectExportParams(projectId, userId, JSON.stringify(exportParams), DB)

  const row = await getProjectAfterExportUpdate(projectId, userId, DB)
  if (!row) {
    return { ok: false, error: '專案更新後查詢失敗', status: 500 }
  }

  const assetIds = await getSelectedAssetIds(projectId, DB)
  return { ok: true, data: exportUpdateRowToDto(row, assetIds) }
}

export type DeleteProjectResult = { ok: true } | { ok: false; error: string; status: number }

/**
 * DELETE /api/projects/:project_id — 全域刪除專案。先清除物件儲存中的三種 prefix，
 * 再刪除資料庫中所有關聯資料。
 *
 * 潛在風險：物件儲存刪除與資料庫交易不是同一個原子操作。
 * 若物件儲存刪除成功、但資料庫交易中途失敗，會出現檔案已刪但資料庫紀錄還在的不一致狀態。
 */
export async function deleteProject(projectId: string, DB: D1Database, env: Env): Promise<DeleteProjectResult> {
  const exists = await projectExists(projectId, DB)
  if (!exists) {
    return { ok: false, error: '專案不存在', status: 404 }
  }

  try {
    await deleteByPrefix(env, assetsPrefixForSource(projectId))
    await deleteByPrefix(env, thumbsPrefixForSource(projectId))
    await deleteByPrefix(env, exportsPrefixForProject(projectId))
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), status: 500 }
  }

  try {
    await deleteProjectCascade(projectId, DB)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), status: 500 }
  }

  return { ok: true }
}

function rowToAssetDto(row: ProjectAssetRow): ProjectAssetDto {
  return {
    id: row.id,
    extension: row.extension,
    type: row.type,
    source_type: row.source_type,
    source_id: row.source_id,
    created_at: new Date(row.created_at).toISOString(),
    added_at: new Date(row.added_at).toISOString(),
    original_path: `/api/assets/${row.id}/file`,
    thumbnail_path: `/api/assets/${row.id}/thumbnail`,
  }
}

export type CreateProjectResult =
  | { ok: true; data: ProjectDto }
  | { ok: false; error: string }

export async function createProject(body: CreateProjectBody, DB: D1Database): Promise<CreateProjectResult> {
  if (!isNonEmptyString(body?.name)) {
    return { ok: false, error: '缺少必要欄位: name' }
  }
  const name = body.name.trim()

  // 只看 resolution 是否有帶值來決定要不要套預設值；沒帶 resolution 時，
  // 就算有帶 video_duration / total_duration 也會一起被預設值蓋掉
  const exportParams: ExportParams = isNonEmptyString(body.export_params?.resolution)
    ? {
        resolution: body.export_params!.resolution as string,
        video_duration: body.export_params!.video_duration ?? DEFAULT_EXPORT_PARAMS.video_duration,
        total_duration: body.export_params!.total_duration ?? DEFAULT_EXPORT_PARAMS.total_duration,
      }
    : { ...DEFAULT_EXPORT_PARAMS }

  const projectId = crypto.randomUUID()
  const now = Date.now()

  await insertProjectForAllUsers(
    {
      projectId,
      name,
      exportParamsJson: JSON.stringify(exportParams),
      createdAt: now,
    },
    DB,
  )

  const core = await getProjectCoreById(projectId, DB)
  if (!core) {
    // 交易已 commit，理論上一定查得到；防禦性處理避免型別上出現 undefined
    return { ok: false, error: '專案建立後查詢失敗' }
  }

  // caption / status 直接寫死回傳，不重新查詢 user_projects（目前跟資料庫實際值一致，屬刻意行為）。
  // asset_ids 固定回傳空陣列：新專案的素材池必為空，素材建立後才透過匯入/選定端點加入。
  return {
    ok: true,
    data: {
      id: core.id,
      name: core.name,
      export_params: exportParams,
      asset_ids: [],
      caption: '',
      status: 'DRAFT',
      has_active_task: false,
      created_at: new Date(core.created_at).toISOString(),
    },
  }
}
