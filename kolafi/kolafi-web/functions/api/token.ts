import type { Env } from '../types'
import { exchangeToken } from '../services/oauthService'
import { jsonOAuthError } from '../utils/http'
import { getMcpResourceUrl, getPublicOrigin } from '../utils/origin'

/**
 * POST /api/token — 用 `code` 換 access token，或用 refresh token 換新的 access token 與
 * refresh token。依 `grant_type` 分派（`authorization_code`、`refresh_token`）。
 *
 * 呼叫者是第三方網站的伺服器，沒有 Cloudflare Service Token，也沒有 Client 密鑰，因此在
 * `_middleware.ts` 的放行名單內；能擋住別人偷用 `code` 的只有 `code` 本身加上各項比對與
 * PKCE，refresh token 則靠輪替與重用偵測。
 *
 * 請求 body 是表單格式（application/x-www-form-urlencoded），不是 JSON。
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  // 先確認密鑰，避免缺少設定時白白消耗掉 code
  const secret = context.env.OAUTH_JWT_SECRET
  if (!secret) {
    console.error('[token] 缺少環境變數 OAUTH_JWT_SECRET')
    return jsonOAuthError('server_error', 500)
  }

  let form: FormData
  try {
    form = await context.request.formData()
  } catch {
    return jsonOAuthError('invalid_request')
  }

  try {
    const resourceUrl = getMcpResourceUrl(getPublicOrigin(context.request, context.env))
    const result = await exchangeToken(form, secret, resourceUrl, context.env.DB)
    if (!result.ok) {
      return jsonOAuthError(result.error, result.status)
    }
    return Response.json(result.data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[token] 換發 token 失敗', err)
    return jsonOAuthError('server_error', 500)
  }
}
