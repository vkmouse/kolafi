/**
 * 16 進位字串相關的共用函式：隨機值與 SHA-256。
 *
 * OAuth 的授權碼與 refresh token 都是 256 位元隨機值，refresh token 在 DB 只存
 * SHA-256 雜湊，所以兩個函式放在一起共用。
 */

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** 256 位元的隨機值，轉成 64 個 16 進位字元 */
export function generateRandomHex256(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}

/** 對字串做 SHA-256，回傳小寫 16 進位字串 */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return toHex(new Uint8Array(digest))
}
