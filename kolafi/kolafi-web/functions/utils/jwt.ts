/**
 * access token / refresh token 共用簽發驗證邏輯，用 jose（Web Crypto，
 * Workers 相容）做 HS256 簽章。兩者共用 APP_JWT_SECRET，靠 payload 的
 * `type` 欄位互相區分，避免 refresh token 被當 access token 用。
 *
 * kolafi 沒有身分概念要放進 token——只代表「瀏覽器通過了一次 Cloudflare
 * Access」，AppTokenIdentity 是空物件。
 */
import { jwtVerify, SignJWT } from 'jose'

export type AppTokenType = 'access' | 'refresh'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type AppTokenIdentity = Record<string, never>

/** access token 效期：8 小時。 */
export const ACCESS_TOKEN_TTL_SECONDS = 8 * 60 * 60
/** refresh token 效期：10 年，模擬「無限期」（JWT/Cookie 機制上都需要一個實際的到期時間）。 */
export const REFRESH_TOKEN_TTL_SECONDS = 10 * 365 * 24 * 60 * 60

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

async function signAppToken(secret: string, type: AppTokenType, ttlSeconds: number): Promise<string> {
  return await new SignJWT({ type })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(encodeSecret(secret))
}

export async function signAccessToken(secret: string): Promise<string> {
  return signAppToken(secret, 'access', ACCESS_TOKEN_TTL_SECONDS)
}

export async function signRefreshToken(secret: string): Promise<string> {
  return signAppToken(secret, 'refresh', REFRESH_TOKEN_TTL_SECONDS)
}

// DEBUG: 原本只回傳 boolean，catch 裡把真正的失敗原因吃掉了（簽章不符／過期／
// type 不對全部混在一起變成 false）。改成回傳 { ok, reason } 讓呼叫端可以印出
// 實際原因，上線前可以視情況改回單純的 boolean。
export interface AppTokenVerifyResult {
  ok: boolean
  reason?: string
}

/**
 * 驗證簽章／效期，並確認 payload 的 `type` 跟預期一致，避免把 refresh token
 * 塞進 access_token cookie 蒙混過關。
 */
export async function verifyAppToken(
  secret: string,
  token: string,
  expectedType: AppTokenType,
): Promise<AppTokenVerifyResult> {
  try {
    const { payload } = await jwtVerify(token, encodeSecret(secret))
    if (payload.type !== expectedType) {
      return {
        ok: false,
        reason: `token type 不符：預期 "${expectedType}"，實際 "${String(payload.type)}"`,
      }
    }
    return { ok: true }
  } catch (err) {
    const name = err instanceof Error ? err.name : typeof err
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, reason: `${name}: ${message}` }
  }
}
