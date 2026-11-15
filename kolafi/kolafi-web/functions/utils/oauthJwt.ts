/**
 * OAuth Server 簽發給第三方網站（MCP client）的 access token（JWT）共用邏輯。
 *
 * 跟 `jwt.ts` 的應用程式自用憑證完全分開：用另一把密鑰（OAUTH_JWT_SECRET），
 * claims 只放 `client_id`、`aud`（MCP 伺服器的網址）和 `exp`，不放 `iat`、
 * `iss`、`sub`，也沒有 `type`，兩套憑證不會互相通用。
 *
 * 同樣用 `jose`（Web Crypto，Workers 相容）做 HS256 簽章。
 */
import { jwtVerify, SignJWT } from 'jose'

/** OAuth access token 效期：30 分鐘。無狀態 JWT，不能撤銷；到期後用 refresh token 換新的 */
export const OAUTH_ACCESS_TOKEN_TTL_SECONDS = 30 * 60

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

/** 簽發 OAuth access token（HS256，30 分鐘），`aud` 是 MCP 伺服器的網址 */
export async function signOAuthAccessToken(secret: string, clientId: string, resourceUrl: string): Promise<string> {
  return await new SignJWT({ client_id: clientId })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(resourceUrl)
    .setExpirationTime(`${OAUTH_ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(encodeSecret(secret))
}

/**
 * 驗 HS256 簽章、`exp` 尚未過期、`aud` 是這個資源伺服器的網址。缺少 `exp` 或 `aud`
 * 也視為不合法。任何原因的驗證失敗（簽章不符、格式不符、已過期等）一律回傳 false，
 * 不細分失敗原因。
 */
export async function verifyOAuthAccessToken(secret: string, token: string, resourceUrl: string): Promise<boolean> {
  try {
    await jwtVerify(token, encodeSecret(secret), {
      algorithms: ['HS256'],
      requiredClaims: ['exp'],
      audience: resourceUrl,
    })
    return true
  } catch {
    return false
  }
}
