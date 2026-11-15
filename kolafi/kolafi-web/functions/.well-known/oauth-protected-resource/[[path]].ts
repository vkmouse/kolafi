import type { Env } from '../../types'
import { getMcpResourceUrl, getPublicOrigin, MCP_RESOURCE_PATH } from '../../utils/origin'

/**
 * GET /.well-known/oauth-protected-resource — 受保護資源中繼資料（RFC 9728）。
 *
 * 同時處理兩種網址，回傳同一份內容：
 * - `/.well-known/oauth-protected-resource`（根目錄版，`WWW-Authenticate` 指的就是這個）
 * - `/.well-known/oauth-protected-resource/api/mcp`（RFC 9728 的路徑插入版，
 *   MCP 的 client 沒有收到 `resource_metadata` 時會先試這個）
 *
 * 其他路徑一律 404，避免落入 SPA fallback 回出 index.html。
 *
 * 不在 `/api` 底下，不經過 `api/_middleware.ts`。內容依請求網域動態產生，不寫死網域。
 */
export const onRequestGet: PagesFunction<Env, 'path'> = async (context) => {
  const segments = context.params.path
  const suffix = Array.isArray(segments) ? `/${segments.join('/')}` : ''

  if (suffix !== '' && suffix !== MCP_RESOURCE_PATH) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }

  const origin = getPublicOrigin(context.request, context.env)
  return Response.json({
    resource: getMcpResourceUrl(origin),
    authorization_servers: [origin],
    bearer_methods_supported: ['header'],
  })
}
