/**
 * 用 refresh_token 換發新的 access_token，不必重新走一次 Access 驗證流程。
 * 不 rotate refresh token：只換發 access token，refresh_token Cookie 維持原樣。
 */
import type { Env } from '../../types'
import { verifyAppToken, signAccessToken, ACCESS_TOKEN_TTL_SECONDS } from '../../utils/jwt'
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME, buildAppCookie, getCookie } from '../../utils/cookie'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context

  if (!env.APP_JWT_SECRET) {
    console.error('[auth] 缺少環境變數 APP_JWT_SECRET')
    return new Response('Unauthorized', { status: 401 })
  }

  const refreshToken = getCookie(request.headers.get('Cookie'), REFRESH_TOKEN_COOKIE_NAME)
  if (!refreshToken) {
    return new Response('Unauthorized', { status: 401 })
  }

  const valid = await verifyAppToken(env.APP_JWT_SECRET, refreshToken, 'refresh')
  if (!valid) {
    return new Response('Unauthorized', { status: 401 })
  }

  const newAccessToken = await signAccessToken(env.APP_JWT_SECRET)

  const response = Response.json({ ok: true })
  response.headers.append(
    'Set-Cookie',
    buildAppCookie(ACCESS_TOKEN_COOKIE_NAME, newAccessToken, ACCESS_TOKEN_TTL_SECONDS),
  )
  return response
}
