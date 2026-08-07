/**
 * 登入端點：驗證 Cloudflare Access 附上的 Cf-Access-Jwt-Assertion，通過就簽發
 * access token + refresh token。沒有 email/userId 對照需求，不查也不動 DB。
 */
import type { Env } from '../../types'
import { verifyAccessAssertion } from '../../utils/access'
import { signAccessToken, signRefreshToken, ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from '../../utils/jwt'
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME, buildAppCookie } from '../../utils/cookie'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context

  if (!env.APP_JWT_SECRET) {
    console.error('[auth] 缺少環境變數 APP_JWT_SECRET')
    return new Response('Unauthorized', { status: 401 })
  }

  const assertion = request.headers.get('Cf-Access-Jwt-Assertion')
  if (!assertion) {
    return new Response('Unauthorized', { status: 401 })
  }

  const verified = await verifyAccessAssertion(env, assertion)
  if (!verified) {
    return new Response('Unauthorized', { status: 401 })
  }

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(env.APP_JWT_SECRET),
    signRefreshToken(env.APP_JWT_SECRET),
  ])

  const response = Response.json({ ok: true })
  response.headers.append(
    'Set-Cookie',
    buildAppCookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, ACCESS_TOKEN_TTL_SECONDS),
  )
  response.headers.append(
    'Set-Cookie',
    buildAppCookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, REFRESH_TOKEN_TTL_SECONDS),
  )
  return response
}
