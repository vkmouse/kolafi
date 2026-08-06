import type { Env } from '../../types'
import { deleteAsset } from '../../services/assetService'
import { jsonError, jsonMessage } from '../../utils/http'
import { isValidUuid } from '../../utils/validators'

/** DELETE /api/assets/:asset_id — 刪除素材，不需要使用者驗證、不需要專案存取驗證 */
export const onRequestDelete: PagesFunction<Env, 'asset_id'> = async (context) => {
  const assetId = String(context.params.asset_id)
  if (!isValidUuid(assetId)) {
    return jsonError('Invalid asset ID', 400)
  }

  try {
    const result = await deleteAsset(assetId, context.env.DB, context.env)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    return jsonMessage('素材已刪除')
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
