export interface Env {
  DB: D1Database
  /**
   * 物件儲存（S3 相容 API，實際部署可能是 MinIO）連線設定：
   * 單一 bucket，內部以 assets/、thumbs/、exports/ prefix 區分用途。
   */
  S3_ENDPOINT: string
  S3_REGION: string
  S3_ACCESS_KEY_ID: string
  S3_SECRET_ACCESS_KEY: string
  S3_BUCKET: string
  S3_FORCE_PATH_STYLE: string
  S3_CF_ACCESS_CLIENT_ID: string
  S3_CF_ACCESS_CLIENT_SECRET: string
  /**
   * kolafi-worker（合併後的地端 worker，coordinator 對外統一 port）的 base URL，
   * 建立任務後用來打 best-effort 的 `POST {KOLAFI_WORKER_BASE_URL}/notify/<task_type>`。
   * 正式環境下這裡應該是「反向代理」的入口，不是直接連地端 worker。
   */
  KOLAFI_WORKER_BASE_URL: string
  KOLAFI_WORKER_CF_ACCESS_CLIENT_ID: string
  KOLAFI_WORKER_CF_ACCESS_CLIENT_SECRET: string
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
  APP_JWT_SECRET?: string
}

// Auth

/** 標記這次操作算誰的，不是身分驗證 */
export interface ActingUserContext {
  userId: string
}

// Users

/** GET /api/users 對外回傳的使用者資料結構；只含 id、name，不含 created_at */
export interface UserDto {
  id: string
  name: string
}

// Projects

export interface ExportParams {
  resolution: string
  video_duration: number
  total_duration: number
}

/** GET/POST /api/projects 對外回傳的專案資料結構 */
export interface ProjectDto {
  id: string
  name: string
  export_params: ExportParams
  asset_ids: string[]
  caption: string
  status: string
  export_url?: string
  has_active_task: boolean
  created_at: string
}

export interface Pagination {
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface CreateProjectBody {
  name?: unknown
  export_params?: Partial<ExportParams> | null
}

/** PUT /api/projects/:project_id/name request body */
export interface UpdateProjectNameBody {
  name?: unknown
}

/** PUT /api/projects/:project_id/status request body */
export interface UpdateProjectStatusBody {
  status?: unknown
}

/** PUT /api/projects/:project_id/caption request body */
export interface UpdateProjectCaptionBody {
  caption?: unknown
}

/**
 * PUT /api/projects/:project_id/export request body。四個欄位皆為可選、部分更新語意：
 * 只更新請求中有帶的欄位，其餘保留原值；asset_ids 只要有帶（即使是空陣列）就整批覆蓋最終選定清單，
 * id 必須已存在於該專案的素材池，否則回 400。
 */
export interface UpdateProjectExportBody {
  resolution?: unknown
  video_duration?: unknown
  total_duration?: unknown
  asset_ids?: unknown
}

/** GET /api/projects/stats 對外回傳的統計資料結構 */
export interface ProjectStatsDto {
  total: number
  draft: number
  pending: number
  published: number
}

export interface ProjectAssetDto {
  id: string
  extension: string
  type: string
  source_type: string
  source_id: string
  created_at: string
  added_at: string
  original_path: string
  thumbnail_path: string
}

/** POST /api/projects/:project_id/assets request body */
export interface ImportProjectAssetsBody {
  asset_ids?: unknown
}

export interface ImportProjectAssetsResultDto {
  imported: string[]
  skipped: { asset_id: string; reason: string }[]
  total: number
}

/** PUT /api/projects/:project_id/assets/select request body */
export interface SelectProjectAssetsBody {
  asset_ids?: unknown
}

/** POST /api/projects/:project_id/assets/upload 回應；比 ProjectAssetDto 少 added_at，original_path 此端點固定回傳空字串 */
export interface UploadedProjectAssetDto {
  id: string
  extension: string
  type: string
  source_type: string
  source_id: string
  created_at: string
  original_path: string
  thumbnail_path: string
}

/** GET /api/projects/:project_id 對外回傳的專案詳情結構；export_params 沒有預設值回退，且不含 has_active_task */
export interface ProjectDetailDto {
  id: string
  name: string
  export_params: ExportParams
  asset_ids: string[]
  caption: string
  status: string
  export_url?: string
  created_at: string
  assets: ProjectAssetDto[]
}

// Assets

/**
 * 全域素材（不綁定特定專案）的基本結構。
 * 與 ProjectAssetDto 不同：created_at 是 epoch ms（整數）而非 ISO 字串，是刻意的型別差異，不是遺漏。
 */
export interface AssetDto {
  id: string
  extension: string
  type: string
  source_type: string
  source_id: string
  created_at: number
  original_path: string
  thumbnail_path: string
}

/** GET /api/assets 清單專用，比 AssetDto 多一個 is_used 欄位（是否已被任一專案匯入使用） */
export interface AssetWithUsageDto extends AssetDto {
  is_used: boolean
}

/** GET /api/assets/stats 對外回傳的統計資料結構 */
export interface AssetStatsDto {
  total: number
  unused: number
  image: number
  video: number
}

// Tags

/** GET /api/tags 對外回傳的全域標籤資料結構 */
export interface TagDto {
  id: string
  name: string
  is_selected: boolean
  sort_order: number
  created_at: string
}

/** POST /api/tags request body */
export interface CreateTagBody {
  name?: unknown
}

/** PUT /api/tags/reorder request body */
export interface ReorderTagsBody {
  tag_ids?: unknown
}

/** PUT /api/tags/:tag_id/select request body */
export interface UpdateTagSelectBody {
  is_selected?: unknown
}

// Project Tags

/** GET/POST /api/projects/:project_id/tags 對外回傳的專案標籤資料結構 */
export interface ProjectTagDto {
  id: string
  project_id: string
  name: string
  is_selected: boolean
  sort_order: number
  created_at: string
}

/** POST /api/projects/:project_id/tags request body */
export interface CreateProjectTagBody {
  name?: unknown
}

/** PUT /api/projects/:project_id/tags/:tag_id/select request body */
export interface UpdateProjectTagSelectBody {
  is_selected?: unknown
}

/** PUT /api/projects/:project_id/tags/reorder request body */
export interface ReorderProjectTagsBody {
  tag_ids?: unknown
}

// Tasks（前端 Tasks API，`/api/tasks/{type}`，供使用者建立/查詢任務；internal Pull/Ack API 是 Worker 專用的另一組端點）

/** GET /api/tasks/{type} 清單項目；project_id/user_id 為 NULL 時整個 key 省略，不是 null */
export interface TaskDto {
  id: string
  type: string
  project_id?: string
  user_id?: string
  status: string
  created_at: string
}

/** POST /api/tasks/tag request body */
export interface CreateTagTaskBody {
  project_id?: unknown
}

/** POST /api/tasks/download request body */
export interface CreateDownloadTaskBody {
  project_id?: unknown
}

/** POST /api/tasks/export request body */
export interface CreateExportTaskBody {
  project_id?: unknown
}

/** POST /api/tasks/caption request body */
export interface CreateCaptionTaskBody {
  project_id?: unknown
}
