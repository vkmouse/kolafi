import type { Env } from '../types'
import { authorize } from '../services/oauthService'
import { jsonOAuthError } from '../utils/http'
import { getMcpResourceUrl, getPublicOrigin } from '../utils/origin'
import { isRecord } from '../utils/validators'

/**
 * POST /api/authorize — 驗證授權請求並產生 `code`。
 *
 * 由 /authorize 前端畫面呼叫，外層由 Cloudflare Access 的 Service Token 把關（後端不再
 * 驗證），沒有使用者登入與同意授權，因此在 `_middleware.ts` 的放行名單內，不要求
 * access_token Cookie。
 *
 * 失敗一律回 400：前端靠 400 判斷是授權請求本身有問題，顯示錯誤而不導回第三方網站。
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: unknown
  try {
    body = await context.request.json()
  } catch {
    return jsonOAuthError('invalid_request')
  }
  if (!isRecord(body)) {
    return jsonOAuthError('invalid_request')
  }

  try {
    const resourceUrl = getMcpResourceUrl(getPublicOrigin(context.request, context.env))
    const result = await authorize(body, resourceUrl, context.env.DB)
    if (!result.ok) {
      return jsonOAuthError(result.error, result.status)
    }
    return Response.json(result.data)
  } catch (err) {
    console.error('[authorize] 授權失敗', err)
    return jsonOAuthError('server_error', 500)
  }
}
