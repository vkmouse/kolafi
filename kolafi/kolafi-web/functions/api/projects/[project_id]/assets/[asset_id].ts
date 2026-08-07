import type { Env } from '../../../../types'
import { resolveActingUser, authenticateProjectAccess } from '../../../../middleware/actorContext'
import { removeAssetFromProject } from '../../../../services/projectAssetService'
import { jsonError, jsonMessage } from '../../../../utils/http'
import { isValidUuid } from '../../../../utils/validators'

/** DELETE /api/projects/:project_id/assets/:asset_id — 從專案素材池移除，不影響 assets 本體 */
export const onRequestDelete: PagesFunction<Env, 'project_id' | 'asset_id'> = async (context) => {
  const auth = await resolveActingUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response

  const projectAuth = await authenticateProjectAccess(String(context.params.project_id), auth.userId, context.env.DB)
  if (!projectAuth.ok) return projectAuth.response

  const assetId = String(context.params.asset_id)
  if (!isValidUuid(assetId)) {
    return jsonError('Invalid asset ID', 400)
  }

  try {
    const result = await removeAssetFromProject(projectAuth.projectId, assetId, context.env.DB)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    return jsonMessage('素材已移除')
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
