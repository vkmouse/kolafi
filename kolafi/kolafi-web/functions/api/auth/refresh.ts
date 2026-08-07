/**
 * 用 refresh_token 換發新的 access_token，不必重新走一次 Access 驗證流程。
 * 不 rotate refresh token：只換發 access token，refresh_token Cookie 維持原樣。
 */
import type { Env } from '../../types'
import { verifyAppToken, signAccessToken, ACCESS_TOKEN_TTL_SECONDS } from '../../utils/jwt'
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME, buildAppCookie, getCookie } from '../../utils/cookie'

// DEBUG: 下面三個 401 回應都帶了詳細除錯資訊，正式上線前要改回單純的
// `new Response('Unauthorized', { status: 401 })`，避免把內部細節曝露給前端。

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context

  if (!env.APP_JWT_SECRET) {
    console.error('[auth] 缺少環境變數 APP_JWT_SECRET')
    return Response.json(
      {
        error: 'Unauthorized',
        stage: 'env-check',
        reason: '缺少環境變數 APP_JWT_SECRET',
        expected: 'APP_JWT_SECRET 應該要在 Pages 專案的環境變數 / secret 裡設定',
        actual: 'env.APP_JWT_SECRET 為空字串或 undefined',
      },
      { status: 401 },
    )
  }

  const refreshToken = getCookie(request.headers.get('Cookie'), REFRESH_TOKEN_COOKIE_NAME)
  if (!refreshToken) {
    return Response.json(
      {
        error: 'Unauthorized',
        stage: 'cookie-check',
        reason: `請求裡沒有 ${REFRESH_TOKEN_COOKIE_NAME} cookie`,
        expected: `Cookie header 應包含 ${REFRESH_TOKEN_COOKIE_NAME}=<refresh token>`,
        actual: request.headers.get('Cookie')
          ? 'Cookie header 存在，但找不到這個 cookie 名稱'
          : 'Cookie header 完全不存在',
        hint: '確認前端呼叫時有帶上 credentials（fetch 需要 credentials: "include"），以及 /api/auth/login 是否真的有成功回應並 Set-Cookie（看瀏覽器 DevTools 的 Application/Cookies）。',
      },
      { status: 401 },
    )
  }

  const valid = await verifyAppToken(env.APP_JWT_SECRET, refreshToken, 'refresh')
  if (!valid.ok) {
    console.error('[auth] verifyAppToken(refresh) 失敗:', valid.reason)
    return Response.json(
      {
        error: 'Unauthorized',
        stage: 'verifyAppToken',
        reason: valid.reason ?? '未知原因',
        expected: 'token 的 payload.type 應為 "refresh"，且簽章／效期需合法',
        hint: '常見原因：1) APP_JWT_SECRET 跟簽發當下不一致（環境變數換過） 2) token 已過期（refresh token TTL 10 年，通常不太可能） 3) cookie 裡帶的其實是 access token 而不是 refresh token。',
      },
      { status: 401 },
    )
  }

  const newAccessToken = await signAccessToken(env.APP_JWT_SECRET)

  const response = Response.json({ ok: true })
  response.headers.append(
    'Set-Cookie',
    buildAppCookie(ACCESS_TOKEN_COOKIE_NAME, newAccessToken, ACCESS_TOKEN_TTL_SECONDS),
  )
  return response
}
