import type { Env, ReorderProjectTagsBody } from '../../../../types'
import { authenticateUser, authenticateProjectAccess } from '../../../../middleware/authMiddleware'
import { reorderProjectTags } from '../../../../services/projectTagService'
import { jsonError, jsonSuccess } from '../../../../utils/http'

/** PUT /api/projects/:project_id/tags/reorder — 重新排序指定專案的所有標籤 */
export const onRequestPut: PagesFunction<Env, 'project_id'> = async (context) => {
  const auth = await authenticateUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response

  const projectAuth = await authenticateProjectAccess(String(context.params.project_id), auth.userId, context.env.DB)
  if (!projectAuth.ok) return projectAuth.response

  let body: ReorderProjectTagsBody
  try {
    body = (await context.request.json()) as ReorderProjectTagsBody
  } catch {
    return jsonError('缺少必要欄位: tag_ids', 400)
  }

  if (!Array.isArray(body.tag_ids)) {
    return jsonError('缺少必要欄位: tag_ids', 400)
  }

  try {
    const result = await reorderProjectTags(projectAuth.projectId, body.tag_ids as string[], context.env.DB)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    return jsonSuccess()
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
