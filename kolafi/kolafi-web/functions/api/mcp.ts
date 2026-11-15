import type { Env } from '../types'
import { handleMcpRequest } from '../services/mcpService'
import { verifyOAuthAccessToken } from '../utils/oauthJwt'
import { getMcpResourceUrl, getPublicOrigin } from '../utils/origin'

/**
 * /api/mcp — MCP 伺服器（OAuth 的資源伺服器）。
 *
 * 呼叫者是第三方網站的伺服器（MCP client），沒有 Cloudflare Service Token 也沒有 Cookie，
 * 因此在 `_middleware.ts` 的放行名單內；唯一的門禁是 `Authorization: Bearer` 帶的
 * access token（JWT），驗 HS256 簽章、`exp` 與 `aud`。
 *
 * 驗證通過後交給 `mcpService` 處理 MCP 協定本身。任何 HTTP 方法都先走同一套驗證，
 * 所以用 onRequest 而不是個別方法。
 */

/**
 * 沒帶 Authorization、格式不是 `Bearer <token>`、簽章不符、已過期、`aud` 不符，
 * 一律用同一個回應。Client 靠 WWW-Authenticate 找到受保護資源中繼資料，再找到授權伺服器。
 */
function invalidToken(origin: string): Response {
  const metadataUrl = `${origin}/.well-known/oauth-protected-resource`
  return Response.json(
    { error: 'invalid_token' },
    {
      status: 401,
      headers: { 'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}"` },
    },
  )
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const origin = getPublicOrigin(context.request, context.env)

  const secret = context.env.OAUTH_JWT_SECRET
  if (!secret) {
    // 缺少設定就無法驗證，一律視為驗證不通過，不放行
    console.error('[mcp] 缺少環境變數 OAUTH_JWT_SECRET')
    return invalidToken(origin)
  }

  const token = /^Bearer (.+)$/i.exec(context.request.headers.get('Authorization') ?? '')?.[1]
  if (!token || !(await verifyOAuthAccessToken(secret, token, getMcpResourceUrl(origin)))) {
    return invalidToken(origin)
  }

  return await handleMcpRequest(context.request, context.env.DB)
}
