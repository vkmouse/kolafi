import type { Env, UpdateProjectCaptionBody } from '../../../types'
import { authenticateUser, authenticateProjectAccess } from '../../../middleware/authMiddleware'
import { updateProjectCaption } from '../../../services/projectService'
import { jsonError, jsonOk } from '../../../utils/http'

/** PUT /api/projects/:project_id/caption — 更新目前使用者對此專案的文案（個人欄位，只影響呼叫者自己） */
export const onRequestPut: PagesFunction<Env, 'project_id'> = async (context) => {
  const auth = await authenticateUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response

  const projectAuth = await authenticateProjectAccess(String(context.params.project_id), auth.userId, context.env.DB)
  if (!projectAuth.ok) return projectAuth.response

  let body: UpdateProjectCaptionBody
  try {
    body = (await context.request.json()) as UpdateProjectCaptionBody
  } catch {
    return jsonError('缺少必要欄位: caption', 400)
  }

  try {
    const result = await updateProjectCaption(projectAuth.projectId, auth.userId, body, context.env.DB)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    return jsonOk(result.data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
