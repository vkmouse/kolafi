/**
 * `/api/*` 專屬中介層（Cloudflare Pages Functions 依目錄自動限縮套用範圍）。
 *
 * login/refresh 自行處理驗證，這裡直接放行；/api/internal/* 是地端 worker
 * 用 Service Token 直打 Access edge 的另一條路徑，邊界防護在 edge，也跳過。
 * 其餘一律驗 access_token Cookie 的 App JWT，驗不過回 401。
 *
 * 這裡只確認「瀏覽器有沒有通過 Cloudflare Access」，跟驗證使用者能不能存取
 * 特定資源的 functions/middleware/authMiddleware.ts 是兩件事，互不影響。
 */
import type { Env } from '../types'
import { verifyAppToken } from '../utils/jwt'
import { ACCESS_TOKEN_COOKIE_NAME, getCookie } from '../utils/cookie'

const SKIP_AUTH_PATHS = new Set(['/api/auth/login', '/api/auth/refresh'])
const SKIP_AUTH_PREFIXES = ['/api/internal/']

// DEBUG: 下面三個 401 回應都帶了詳細除錯資訊，正式上線前要改回單純的
// `new Response('Unauthorized', { status: 401 })`，避免把內部細節曝露給前端。

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env, request } = context
  const { pathname } = new URL(request.url)

  if (SKIP_AUTH_PATHS.has(pathname) || SKIP_AUTH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return await context.next()
  }

  if (!env.APP_JWT_SECRET) {
    console.error('[auth] 缺少環境變數 APP_JWT_SECRET')
    return Response.json(
      {
        error: 'Unauthorized',
        stage: 'env-check',
        pathname,
        reason: '缺少環境變數 APP_JWT_SECRET',
        expected: 'APP_JWT_SECRET 應該要在 Pages 專案的環境變數 / secret 裡設定',
        actual: 'env.APP_JWT_SECRET 為空字串或 undefined',
      },
      { status: 401 },
    )
  }

  const token = getCookie(request.headers.get('Cookie'), ACCESS_TOKEN_COOKIE_NAME)
  if (!token) {
    return Response.json(
      {
        error: 'Unauthorized',
        stage: 'cookie-check',
        pathname,
        reason: `請求裡沒有 ${ACCESS_TOKEN_COOKIE_NAME} cookie`,
        expected: `Cookie header 應包含 ${ACCESS_TOKEN_COOKIE_NAME}=<access token>`,
        actual: request.headers.get('Cookie')
          ? 'Cookie header 存在，但找不到這個 cookie 名稱'
          : 'Cookie header 完全不存在',
        hint: '確認前端有帶 credentials（fetch 需要 credentials: "include"），以及是否已經先成功呼叫過 /api/auth/login 拿到 cookie。',
      },
      { status: 401 },
    )
  }

  const valid = await verifyAppToken(env.APP_JWT_SECRET, token, 'access')
  if (!valid.ok) {
    console.error('[auth] verifyAppToken(access) 失敗:', valid.reason)
    return Response.json(
      {
        error: 'Unauthorized',
        stage: 'verifyAppToken',
        pathname,
        reason: valid.reason ?? '未知原因',
        expected: 'token 的 payload.type 應為 "access"，且簽章／效期需合法',
        hint: '常見原因：1) access token 已過期（TTL 8 小時），應該讓前端呼叫 /api/auth/refresh 換發新的 2) APP_JWT_SECRET 換過導致舊 token 簽章對不上。',
      },
      { status: 401 },
    )
  }

  return await context.next()
}
