/**
 * 登入端點：驗證 Cloudflare Access 附上的 Cf-Access-Jwt-Assertion，通過就簽發
 * access token + refresh token。沒有 email/userId 對照需求，不查也不動 DB。
 */
import type { Env } from '../../types'
import { verifyAccessAssertion } from '../../utils/access'
import { signAccessToken, signRefreshToken, ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from '../../utils/jwt'
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME, buildAppCookie } from '../../utils/cookie'

// DEBUG: 下面三個 401 回應都帶了詳細除錯資訊（env 變數是否存在、實際失敗原因、
// 預期 vs 實際等）。這只是為了 debug，正式上線前要改回單純的
// `new Response('Unauthorized', { status: 401 })`，避免把內部細節曝露給前端。

export const onRequestGet: PagesFunction<Env> = async (context) => {
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

  const assertion = request.headers.get('Cf-Access-Jwt-Assertion')
  if (!assertion) {
    return Response.json(
      {
        error: 'Unauthorized',
        stage: 'assertion-header',
        reason: '請求裡沒有 Cf-Access-Jwt-Assertion header',
        expected: '這個 header 應該由 Cloudflare Access 在通過驗證後自動附加',
        actual: 'request.headers.get("Cf-Access-Jwt-Assertion") 為 null',
        hint: '確認這個路徑確實被 Cloudflare Access Application 保護、且是透過瀏覽器直接呼叫（不是繞過 Access edge 的內部呼叫）；也可以檢查中間有沒有 CDN/Proxy 把這個 header 濾掉。',
        headerNames: Array.from(request.headers.keys()),
      },
      { status: 401 },
    )
  }

  const verified = await verifyAccessAssertion(env, assertion)
  if (!verified.ok) {
    console.error('[auth] verifyAccessAssertion 失敗:', verified.reason)
    return Response.json(
      {
        error: 'Unauthorized',
        stage: 'verifyAccessAssertion',
        reason: verified.reason ?? '未知原因',
        expected: {
          issuer: env.ACCESS_TEAM_DOMAIN,
          audience: env.ACCESS_AUD,
        },
        hint: '常見原因：1) ACCESS_AUD 跟 Cloudflare Access Application 的 Audience Tag 不一致 2) ACCESS_TEAM_DOMAIN 打錯（應為 https://<team-name>.cloudflareaccess.com，注意有沒有多/少 https:// 或結尾斜線）3) assertion 已過期（Access session 過期需要重新登入）4) JWKS 端點（/cdn-cgi/access/certs）連不到。',
      },
      { status: 401 },
    )
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
