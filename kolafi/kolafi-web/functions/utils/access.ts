/**
 * 驗證 Cloudflare Access 簽發的 Cf-Access-Jwt-Assertion，只有 login.ts 會用到
 *（其他 /api/* 改驗 functions/utils/jwt.ts 簽的 App JWT）。
 *
 * kolafi 沒有多身分對照需求，只要簽章／aud／iss／exp 合法就視為通過，
 * 不解析 payload 裡的 common_name 等欄位。
 */
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Env } from '../types'

/** 缺少環境變數或驗證失敗一律回傳 false。 */
export async function verifyAccessAssertion(
  env: Pick<Env, 'ACCESS_TEAM_DOMAIN' | 'ACCESS_AUD'>,
  assertion: string,
): Promise<boolean> {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    console.error('[auth] 缺少環境變數 ACCESS_TEAM_DOMAIN 或 ACCESS_AUD')
    return false
  }

  try {
    const jwks = createRemoteJWKSet(new URL(`${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`))

    await jwtVerify(assertion, jwks, {
      issuer: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_AUD,
    })

    return true
  } catch {
    return false
  }
}
