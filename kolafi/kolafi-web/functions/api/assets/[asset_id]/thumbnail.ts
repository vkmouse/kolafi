import type { Env } from '../../../types'
import { getAssetThumbnail } from '../../../services/assetService'
import { jsonError } from '../../../utils/http'
import { isValidUuid } from '../../../utils/validators'

/**
 * GET /api/assets/:asset_id/thumbnail — 代理讀取素材縮圖，不需要使用者驗證、不需要專案存取驗證。
 * 成功時直接回傳縮圖二進位內容（非 JSON 信封）。
 */
export const onRequestGet: PagesFunction<Env, 'asset_id'> = async (context) => {
  const assetId = String(context.params.asset_id)
  if (!isValidUuid(assetId)) {
    return jsonError('Invalid asset ID', 400)
  }

  try {
    const result = await getAssetThumbnail(assetId, context.env.DB, context.env)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }

    return new Response(result.body, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
