import type { Env } from '../../types'
import { getAssetStats } from '../../services/assetService'
import { jsonError, jsonOk } from '../../utils/http'

/** GET /api/assets/stats — 取得全域素材統計數據，不需要使用者驗證、不需要專案存取驗證 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const stats = await getAssetStats(context.env.DB)
    return jsonOk(stats)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
