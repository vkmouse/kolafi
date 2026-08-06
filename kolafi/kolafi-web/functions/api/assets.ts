import type { Env } from '../types'
import { getAssetList, parseListAssetsQuery } from '../services/assetService'
import { jsonError, jsonOkInfiniteScroll } from '../utils/http'

/** GET /api/assets — 取得全域素材清單（分頁），不需要使用者驗證、不需要專案存取驗證 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const query = parseListAssetsQuery(url.searchParams)

  try {
    const { data, hasMore, page } = await getAssetList(query, context.env.DB)
    return jsonOkInfiniteScroll(data, hasMore, page)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
