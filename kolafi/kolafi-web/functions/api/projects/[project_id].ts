import type { Env } from '../../types'
import { authenticateUser, authenticateProjectAccess } from '../../middleware/authMiddleware'
import { deleteProject, getProjectDetail } from '../../services/projectService'
import { jsonError, jsonOk } from '../../utils/http'

/** GET /api/projects/:project_id — 專案詳情，含目前使用者對此專案的狀態、文案與素材清單 */
export const onRequestGet: PagesFunction<Env, 'project_id'> = async (context) => {
  const auth = await authenticateUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response

  const projectAuth = await authenticateProjectAccess(String(context.params.project_id), auth.userId, context.env.DB)
  if (!projectAuth.ok) return projectAuth.response

  try {
    const detail = await getProjectDetail(auth.userId, projectAuth.projectId, context.env.DB)
    if (!detail) {
      return jsonError('專案不存在或無權限訪問', 404)
    }
    return jsonOk(detail)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}

/**
 * DELETE /api/projects/:project_id — 全域刪除專案（對所有使用者），連動清除物件儲存中的素材、
 * 縮圖、匯出檔，以及資料庫中所有關聯資料
 */
export const onRequestDelete: PagesFunction<Env, 'project_id'> = async (context) => {
  const auth = await authenticateUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response

  const projectAuth = await authenticateProjectAccess(String(context.params.project_id), auth.userId, context.env.DB)
  if (!projectAuth.ok) return projectAuth.response

  try {
    const result = await deleteProject(projectAuth.projectId, context.env.DB, context.env)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    return jsonOk(undefined)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
