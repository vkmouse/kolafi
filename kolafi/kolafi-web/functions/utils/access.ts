/**
 * 驗證 Cloudflare Access 簽發的 Cf-Access-Jwt-Assertion，只有 login.ts 會用到
 *（其他 /api/* 改驗 functions/utils/jwt.ts 簽的 App JWT）。
 *
 * kolafi 沒有多身分對照需求，只要簽章／aud／iss／exp 合法就視為通過，
 * 不解析 payload 裡的 common_name 等欄位。
 */
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Env } from '../types'

// DEBUG: 原本只回傳 boolean，catch 裡把真正的失敗原因吃掉了，導致
// login.ts 永遠只能印出「驗證失敗」而看不出是 aud/iss 不對還是過期。
// 改成回傳 { ok, reason } 讓呼叫端可以印出實際原因，上線前可以視情況
// 改回單純的 boolean（或至少不要把 reason 往外部回應曝露）。
export interface AccessVerifyResult {
  ok: boolean
  reason?: string
}

/** 缺少環境變數或驗證失敗一律回傳 ok: false，並附上具體原因。 */
export async function verifyAccessAssertion(
  env: Pick<Env, 'ACCESS_TEAM_DOMAIN' | 'ACCESS_AUD'>,
  assertion: string,
): Promise<AccessVerifyResult> {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    console.error('[auth] 缺少環境變數 ACCESS_TEAM_DOMAIN 或 ACCESS_AUD')
    return { ok: false, reason: '缺少環境變數 ACCESS_TEAM_DOMAIN 或 ACCESS_AUD' }
  }

  try {
    const jwks = createRemoteJWKSet(new URL(`${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`))

    await jwtVerify(assertion, jwks, {
      issuer: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_AUD,
    })

    return { ok: true }
  } catch (err) {
    const name = err instanceof Error ? err.name : typeof err
    const message = err instanceof Error ? err.message : String(err)
    console.error('[auth] verifyAccessAssertion 失敗:', name, message)
    return { ok: false, reason: `${name}: ${message}` }
  }
}
