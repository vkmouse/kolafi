/**
 * 本站對外的網址（origin）與 MCP 資源網址。
 *
 * 兩份探索 metadata、`WWW-Authenticate` 標頭、`resource` 參數的比對、JWT 的
 * `aud` 都從這裡取網址，不在任何地方寫死網域：預設取自請求本身的網址，
 * 想固定成單一正式網域時，設定環境變數 `PUBLIC_ORIGIN`（例如
 * `https://example.com`）即可覆蓋。
 */
import type { Env } from '../types'

/** MCP 伺服器（資源伺服器）的路徑 */
export const MCP_RESOURCE_PATH = '/api/mcp'

/** 本站的 origin，結尾不帶斜線 */
export function getPublicOrigin(request: Request, env: Pick<Env, 'PUBLIC_ORIGIN'>): string {
  const configured = env.PUBLIC_ORIGIN?.trim().replace(/\/+$/, '')
  return configured || new URL(request.url).origin
}

/** 資源伺服器的識別網址，即 MCP 伺服器的網址；也是 access token 的 `aud` */
export function getMcpResourceUrl(origin: string): string {
  return `${origin}${MCP_RESOURCE_PATH}`
}
