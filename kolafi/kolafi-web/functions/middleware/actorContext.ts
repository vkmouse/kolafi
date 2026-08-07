import { userExists } from '../repositories/userRepository'
import { userHasProjectAccess } from '../repositories/projectRepository'
import { isValidUuid } from '../utils/validators'
import { jsonError } from '../utils/http'

export type ActingUserResult = { ok: true; userId: string } | { ok: false; response: Response }
export type ProjectAuthResult = { ok: true; projectId: string } | { ok: false; response: Response }

/**
 * 不是身分驗證：任何通過的人都能宣稱自己是清單上任一個 user。刻意如此，
 * 因為這群使用者彼此信任，切換身分只是標記資料歸屬，不是防冒充。
 */
export async function resolveActingUser(request: Request, DB: D1Database): Promise<ActingUserResult> {
  const userIdHeader = request.headers.get('X-User-Id')

  if (!userIdHeader) {
    return { ok: false, response: jsonError('Missing X-User-Id header', 401) }
  }

  if (!isValidUuid(userIdHeader)) {
    return { ok: false, response: jsonError('Invalid user ID format', 401) }
  }

  const exists = await userExists(userIdHeader, DB)
  if (!exists) {
    return { ok: false, response: jsonError('Invalid user', 401) }
  }

  return { ok: true, userId: userIdHeader }
}

/** 跟 resolveActingUser 不同，這裡是真的權限檢查，不是任意宣稱 */
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
