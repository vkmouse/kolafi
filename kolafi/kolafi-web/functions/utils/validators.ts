const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value)
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/** 必須是純數字字串；解析失敗、<= 0 或超過 max 一律回退 fallback */
export function parsePositiveIntParam(raw: string | null, fallback: number, max?: number): number {
  if (raw === null || raw === '') return fallback
  if (!/^\d+$/.test(raw)) return fallback

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  if (max !== undefined && parsed > max) return fallback

  return parsed
}

/** 只接受 asc/desc，其他任何值（含空字串、缺省）視為 desc */
export function parseSortParam(raw: string | null): 'asc' | 'desc' {
  return raw === 'asc' ? 'asc' : 'desc'
}

/** 空字串或 "ALL" 都視為不篩選 */
export function parseStatusFilter(raw: string | null): string | undefined {
  if (!raw || raw === 'ALL') return undefined
  return raw
}

/** user_projects.status 只接受這三個值之一，大小寫需完全相符 */
export const ALLOWED_PROJECT_STATUSES = ['DRAFT', 'PENDING', 'PUBLISHED'] as const
export type ProjectStatus = (typeof ALLOWED_PROJECT_STATUSES)[number]

export function isValidProjectStatus(value: string): value is ProjectStatus {
  return (ALLOWED_PROJECT_STATUSES as readonly string[]).includes(value)
}

/** GET /api/assets 的 filter 參數 */
export const ALLOWED_ASSET_FILTERS = ['IMAGE', 'VIDEO', 'UNUSED'] as const
export type AssetFilter = (typeof ALLOWED_ASSET_FILTERS)[number]

/** 空值或非 IMAGE/VIDEO/UNUSED 之一（不分大小寫）一律視為不篩選 */
export function parseAssetFilter(raw: string | null): AssetFilter | undefined {
  if (!raw) return undefined
  const upper = raw.toUpperCase()
  return (ALLOWED_ASSET_FILTERS as readonly string[]).includes(upper) ? (upper as AssetFilter) : undefined
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm']

/** 依副檔名（小寫）判斷素材類型；不在支援清單內回傳 null，由呼叫端決定如何拒絕 */
export function resolveAssetType(extension: string): 'IMAGE' | 'VIDEO' | null {
  const ext = extension.toLowerCase()
  if (IMAGE_EXTENSIONS.includes(ext)) return 'IMAGE'
  if (VIDEO_EXTENSIONS.includes(ext)) return 'VIDEO'
  return null
}

/** 取出檔名的副檔名（含 "."，小寫）；沒有副檔名回傳空字串 */
export function extractExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  if (idx === -1) return ''
  return filename.slice(idx).toLowerCase()
}
