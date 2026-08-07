import type { Env, UpdateProjectNameBody } from '../../../types'
import { resolveActingUser, authenticateProjectAccess } from '../../../middleware/actorContext'
import { updateProjectName } from '../../../services/projectService'
import { jsonError, jsonOk } from '../../../utils/http'

/** PUT /api/projects/:project_id/name — 更新專案名稱（全域欄位，影響所有使用者看到的名稱） */
export const onRequestPut: PagesFunction<Env, 'project_id'> = async (context) => {
  const auth = await resolveActingUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response

  const projectAuth = await authenticateProjectAccess(String(context.params.project_id), auth.userId, context.env.DB)
  if (!projectAuth.ok) return projectAuth.response

  let body: UpdateProjectNameBody
  try {
    body = (await context.request.json()) as UpdateProjectNameBody
  } catch {
    return jsonError('缺少必要欄位: name', 400)
  }

  try {
    const result = await updateProjectName(projectAuth.projectId, auth.userId, body, context.env.DB)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    return jsonOk(result.data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
