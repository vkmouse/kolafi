import type { Env, UpdateProjectExportBody } from '../../../types'
import { authenticateUser, authenticateProjectAccess } from '../../../middleware/authMiddleware'
import { updateProjectExport } from '../../../services/projectService'
import { jsonError, jsonOk } from '../../../utils/http'

/**
 * PUT /api/projects/:project_id/export — 更新專案的匯出參數（個人欄位 user_projects.export_params），
 * 若請求中帶了 asset_ids 則另外整批覆蓋最終選定清單。所有欄位皆為可選、部分更新語意。
 */
export const onRequestPut: PagesFunction<Env, 'project_id'> = async (context) => {
  const auth = await authenticateUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response

  const projectAuth = await authenticateProjectAccess(String(context.params.project_id), auth.userId, context.env.DB)
  if (!projectAuth.ok) return projectAuth.response

  let body: UpdateProjectExportBody
  try {
    body = (await context.request.json()) as UpdateProjectExportBody
  } catch {
    return jsonError('無效的請求資料', 400)
  }

  try {
    const result = await updateProjectExport(projectAuth.projectId, auth.userId, body, context.env.DB)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    return jsonOk(result.data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
