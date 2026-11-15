import type { Env } from '../types'
import { getPublicOrigin } from '../utils/origin'

/**
 * GET /.well-known/oauth-authorization-server — 授權伺服器中繼資料（RFC 8414）。
 *
 * 不在 `/api` 底下，不經過 `api/_middleware.ts`。內容依請求網域動態產生，不寫死網域。
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const origin = getPublicOrigin(context.request, context.env)
  return Response.json({
    issuer: origin,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/api/token`,
    registration_endpoint: `${origin}/api/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  })
}
