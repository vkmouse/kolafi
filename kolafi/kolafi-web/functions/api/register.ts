import type { Env } from '../types'
import { registerClient } from '../services/oauthService'
import { jsonOAuthError } from '../utils/http'
import { isRecord } from '../utils/validators'

/**
 * POST /api/register — 動態用戶端註冊（DCR，RFC 7591）。
 *
 * 呼叫者是第三方網站的伺服器（MCP client），沒有 Cloudflare Service Token 也沒有 Cookie，
 * 因此在 `_middleware.ts` 的放行名單內。成功回 201，欄位是協定規定的，不包 { success, data }。
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: unknown
  try {
    body = await context.request.json()
  } catch {
    return jsonOAuthError('invalid_redirect_uri')
  }
  if (!isRecord(body)) {
    return jsonOAuthError('invalid_redirect_uri')
  }

  try {
    const result = await registerClient(body, context.env.DB)
    if (!result.ok) {
      return jsonOAuthError(result.error, result.status)
    }
    return Response.json(result.data, { status: 201 })
  } catch (err) {
    console.error('[register] 註冊用戶端失敗', err)
    return jsonOAuthError('server_error', 500)
  }
}
