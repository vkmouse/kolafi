import type { Env, ImportProjectAssetsBody } from '../../../types'
import { resolveActingUser, authenticateProjectAccess } from '../../../middleware/actorContext'
import { importAssetsToProject } from '../../../services/projectAssetService'
import { jsonError, jsonOk } from '../../../utils/http'

/** POST /api/projects/:project_id/assets — 匯入既有素材到專案素材池（project_assets） */
export const onRequestPost: PagesFunction<Env, 'project_id'> = async (context) => {
  const auth = await resolveActingUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response

  const projectAuth = await authenticateProjectAccess(String(context.params.project_id), auth.userId, context.env.DB)
  if (!projectAuth.ok) return projectAuth.response

  let body: ImportProjectAssetsBody
  try {
    body = (await context.request.json()) as ImportProjectAssetsBody
  } catch {
    return jsonError('缺少必要欄位: asset_ids', 400)
  }

  try {
    const result = await importAssetsToProject(projectAuth.projectId, body, context.env.DB)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    return jsonOk(result.data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
