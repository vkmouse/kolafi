/**
 * `/api/*` 專屬中介層（Cloudflare Pages Functions 依目錄自動限縮套用範圍）。
 *
 * login/refresh 自行處理驗證，這裡直接放行；/api/internal/* 是地端 worker
 * 用 Service Token 直打 Access edge 的另一條路徑，邊界防護在 edge，也跳過。
 * 其餘一律驗 access_token Cookie 的 App JWT，驗不過回 401。
 *
 * 這裡只確認「瀏覽器有沒有通過 Cloudflare Access」，操作歸屬是另一層的事，互不影響。
 */
import type { Env } from '../types'
import { verifyAppToken } from '../utils/jwt'
import { ACCESS_TOKEN_COOKIE_NAME, getCookie } from '../utils/cookie'

const SKIP_AUTH_PATHS = new Set(['/api/auth/login', '/api/auth/refresh'])
const SKIP_AUTH_PREFIXES = ['/api/internal/']

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env, request } = context
  const { pathname } = new URL(request.url)

  if (SKIP_AUTH_PATHS.has(pathname) || SKIP_AUTH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return await context.next()
  }

  if (!env.APP_JWT_SECRET) {
    console.error('[auth] 缺少環境變數 APP_JWT_SECRET')
    return new Response('Unauthorized', { status: 401 })
  }

  const token = getCookie(request.headers.get('Cookie'), ACCESS_TOKEN_COOKIE_NAME)
  if (!token) {
    return new Response('Unauthorized', { status: 401 })
  }

  const valid = await verifyAppToken(env.APP_JWT_SECRET, token, 'access')
  if (!valid) {
    return new Response('Unauthorized', { status: 401 })
  }

  return await context.next()
}
