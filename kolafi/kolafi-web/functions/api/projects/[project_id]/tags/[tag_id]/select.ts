import type { UpdateProjectTagSelectBody, Env } from '../../../../../types'
import { resolveActingUser, authenticateProjectAccess } from '../../../../../middleware/actorContext'
import { updateProjectTagSelected } from '../../../../../services/projectTagService'
import { jsonError, jsonOk } from '../../../../../utils/http'
import { isValidUuid } from '../../../../../utils/validators'

/** PUT /api/projects/:project_id/tags/:tag_id/select — 更新指定專案標籤的選擇狀態 */
export const onRequestPut: PagesFunction<Env, 'project_id' | 'tag_id'> = async (context) => {
  const auth = await resolveActingUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response

  const projectAuth = await authenticateProjectAccess(String(context.params.project_id), auth.userId, context.env.DB)
  if (!projectAuth.ok) return projectAuth.response

  const tagId = context.params.tag_id as string
  if (!isValidUuid(tagId)) {
    return jsonError('Invalid tag ID', 400)
  }

  let body: UpdateProjectTagSelectBody
  try {
    body = (await context.request.json()) as UpdateProjectTagSelectBody
  } catch {
    return jsonError('缺少必要欄位: is_selected', 400)
  }

  const isSelected = body.is_selected === true

  try {
    const result = await updateProjectTagSelected(projectAuth.projectId, tagId, isSelected, context.env.DB)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    return jsonOk(result.data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
