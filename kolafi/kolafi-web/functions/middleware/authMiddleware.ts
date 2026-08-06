import { userExists } from '../repositories/userRepository'
import { userHasProjectAccess } from '../repositories/projectRepository'
import { isValidUuid } from '../utils/validators'
import { jsonError } from '../utils/http'

export type AuthResult = { ok: true; userId: string } | { ok: false; response: Response }
export type ProjectAuthResult = { ok: true; projectId: string } | { ok: false; response: Response }

/** 第 1 層使用者驗證：格式錯誤的 UUID 直接回 401，不查資料庫；格式正確才查 users 表 */
export async function authenticateUser(request: Request, DB: D1Database): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, response: jsonError('Missing or invalid Authorization header', 401) }
  }

  const userId = authHeader.slice('Bearer '.length)

  if (!isValidUuid(userId)) {
    return { ok: false, response: jsonError('Invalid user ID format', 401) }
  }

  const exists = await userExists(userId, DB)
  if (!exists) {
    return { ok: false, response: jsonError('Invalid user', 401) }
  }

  return { ok: true, userId }
}

/** 第 2 層專案存取驗證：需先通過第 1 層。project_id 格式錯誤回 400，使用者無此專案關聯回 403 */
export async function authenticateProjectAccess(
  projectIdParam: string,
  userId: string,
  DB: D1Database,
): Promise<ProjectAuthResult> {
  if (!isValidUuid(projectIdParam)) {
    return { ok: false, response: jsonError('Invalid project ID format', 400) }
  }

  const hasAccess = await userHasProjectAccess(userId, projectIdParam, DB)
  if (!hasAccess) {
    return { ok: false, response: jsonError('Access denied to project', 403) }
  }

  return { ok: true, projectId: projectIdParam }
}
