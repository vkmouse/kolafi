import type { CreateProjectTagBody, Env } from '../../../types'
import { authenticateUser, authenticateProjectAccess } from '../../../middleware/authMiddleware'
import { createProjectTag, getProjectTagList } from '../../../services/projectTagService'
import { jsonError, jsonOk } from '../../../utils/http'
import { isNonEmptyString } from '../../../utils/validators'

/** GET /api/projects/:project_id/tags — 取得指定專案的標籤清單 */
export const onRequestGet: PagesFunction<Env, 'project_id'> = async (context) => {
  const auth = await authenticateUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response

  const projectAuth = await authenticateProjectAccess(String(context.params.project_id), auth.userId, context.env.DB)
  if (!projectAuth.ok) return projectAuth.response

  try {
    const data = await getProjectTagList(projectAuth.projectId, context.env.DB)
    return jsonOk(data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}

/** POST /api/projects/:project_id/tags — 於指定專案新增標籤 */
export const onRequestPost: PagesFunction<Env, 'project_id'> = async (context) => {
  const auth = await authenticateUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response

  const projectAuth = await authenticateProjectAccess(String(context.params.project_id), auth.userId, context.env.DB)
  if (!projectAuth.ok) return projectAuth.response

  let body: CreateProjectTagBody
  try {
    body = (await context.request.json()) as CreateProjectTagBody
  } catch {
    return jsonError('標籤名稱不能為空', 400)
  }

  if (!isNonEmptyString(body.name)) {
    return jsonError('標籤名稱不能為空', 400)
  }

  try {
    const result = await createProjectTag(projectAuth.projectId, body.name, context.env.DB)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    return jsonOk(result.data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
