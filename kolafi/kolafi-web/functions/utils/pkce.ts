/**
 * PKCE（RFC 7636）`S256` 共用邏輯。
 *
 * `/api/token` 用它把 Client 送來的 `code_verifier` 算成 `code_challenge`，
 * 再跟發 `code` 時存下的值比對。
 */

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  // base64url：+ → -、/ → _，並去掉結尾的補位字元 =
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** 對 `code_verifier` 做 SHA-256，再轉成不含補位字元的 base64url */
export async function computeS256CodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  return base64UrlEncode(new Uint8Array(digest))
}
