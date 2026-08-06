import type { Env, SelectProjectAssetsBody } from '../../../../types'
import { authenticateUser, authenticateProjectAccess } from '../../../../middleware/authMiddleware'
import { selectProjectAssets } from '../../../../services/projectAssetService'
import { jsonError, jsonOk } from '../../../../utils/http'

/** PUT /api/projects/:project_id/assets/select — 整批覆蓋專案已選定、排序後的素材清單 */
export const onRequestPut: PagesFunction<Env, 'project_id'> = async (context) => {
  const auth = await authenticateUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response

  const projectAuth = await authenticateProjectAccess(String(context.params.project_id), auth.userId, context.env.DB)
  if (!projectAuth.ok) return projectAuth.response

  let body: SelectProjectAssetsBody
  try {
    body = (await context.request.json()) as SelectProjectAssetsBody
  } catch {
    return jsonError('缺少必要欄位: asset_ids', 400)
  }

  try {
    const result = await selectProjectAssets(projectAuth.projectId, auth.userId, body, context.env.DB)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    return jsonOk(result.data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
