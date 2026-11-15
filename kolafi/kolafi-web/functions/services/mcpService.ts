/**
 * 最簡單的 MCP 伺服器（Streamable HTTP，無狀態），目前只有一個工具 `get_current_time`，
 * 是之後實作真正 MCP 工具的範本。工具的名稱、說明在 `mcpToolDefinitions`，處理函式在
 * `mcpTimeService`，新增工具到下面的 `TOOL_HANDLERS` 登記即可。
 *
 * 協定版本：實作的是「舊版」那一代（2025-11-25 及更早，有 `initialize` 握手）。
 * 官方 SDK 與目前多數 client 都支援這一代；2026-07-28 起的新版（每個請求自帶
 * 版本與身分、沒有 `initialize`）尚未實作。收到新版標頭時，依規範的向下相容
 * 機制回 400 加上「不是新版格式」的錯誤內容，讓同時支援新舊版的 client 自動
 * 退回 `initialize` 流程（見 MCP 規範 Streamable HTTP 的 Backward Compatibility）。
 *
 * 無狀態：不發 `Mcp-Session-Id`，也不提供 GET 串流（回 405），每個 POST 獨立處理。
 *
 * 呼叫者的身分驗證（JWT）由 `api/mcp.ts` 在進來之前完成，這裡只處理協定本身。
 */
import { getCurrentTimeTool } from './mcpTimeService'
import { GET_CURRENT_TIME_TOOL_NAME, TOOL_DEFINITIONS } from './mcpToolDefinitions'
import { isRecord } from '../utils/validators'

const SERVER_INFO = { name: 'kolafi', version: '0.1.0' }

/** 支援的協定版本，新到舊 */
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26']

const PARSE_ERROR = -32700
const INVALID_REQUEST = -32600
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602

const TOOL_HANDLERS: Record<string, (args: Record<string, unknown>, DB: D1Database) => unknown> = {
  [GET_CURRENT_TIME_TOOL_NAME]: getCurrentTimeTool,
}

type JsonRpcId = string | number | null

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: JsonRpcId
  result?: unknown
  error?: { code: number; message: string }
}

function rpcResult(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result }
}

function rpcError(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

/** 工具執行的結果一律放在 text（JSON 字串）；整個呼叫失敗時 isError 為 true，內容只帶通用訊息 */
async function callTool(
  name: string,
  args: Record<string, unknown>,
  DB: D1Database,
): Promise<{ content: { type: 'text'; text: string }[]; isError: boolean }> {
  try {
    const result = await TOOL_HANDLERS[name](args, DB)
    return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: false }
  } catch (err) {
    console.error(`[mcp] 工具 ${name} 執行失敗`, err)
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: '伺服器發生錯誤' } }) }],
      isError: true,
    }
  }
}

/** 處理一則 JSON-RPC 訊息；通知（沒有 id）與用戶端送來的回應不需要回覆，回傳 null */
async function handleMessage(message: unknown, DB: D1Database): Promise<JsonRpcResponse | null> {
  if (!isRecord(message) || message.jsonrpc !== '2.0') {
    return rpcError(null, INVALID_REQUEST, 'Invalid Request')
  }

  // 沒有 method 的是用戶端對伺服器請求的回應；本伺服器不發請求，直接忽略
  if (typeof message.method !== 'string') {
    return 'id' in message ? null : rpcError(null, INVALID_REQUEST, 'Invalid Request')
  }

  // 通知：沒有 id，不回覆（例如 notifications/initialized）
  if (!('id' in message)) {
    return null
  }

  const id = message.id
  if (typeof id !== 'string' && typeof id !== 'number') {
    return rpcError(null, INVALID_REQUEST, 'Invalid Request')
  }

  const params = isRecord(message.params) ? message.params : {}

  switch (message.method) {
    case 'initialize': {
      const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : ''
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
        ? requested
        : SUPPORTED_PROTOCOL_VERSIONS[0]
      return rpcResult(id, {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      })
    }
    case 'ping':
      return rpcResult(id, {})
    case 'tools/list':
      return rpcResult(id, { tools: TOOL_DEFINITIONS })
    case 'tools/call': {
      // 用 hasOwn 而不是 in，避免 toString、constructor 這類繼承來的屬性被當成工具
      if (typeof params.name !== 'string' || !Object.hasOwn(TOOL_HANDLERS, params.name)) {
        return rpcError(id, INVALID_PARAMS, `Unknown tool: ${String(params.name)}`)
      }
      const args = isRecord(params.arguments) ? params.arguments : {}
      return rpcResult(id, await callTool(params.name, args, DB))
    }
    default:
      return rpcError(id, METHOD_NOT_FOUND, `Method not found: ${message.method}`)
  }
}

/** 處理打到 MCP 端點的 HTTP 請求（呼叫端已通過 JWT 驗證） */
export async function handleMcpRequest(request: Request, DB: D1Database): Promise<Response> {
  // 無狀態：沒有 GET 串流，也沒有 session 可以用 DELETE 結束
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'POST' } })
  }

  // 帶了本伺服器不支援的版本（例如 2026-07-28）：回 400，內容刻意不是新版的標準錯誤，
  // 讓同時支援新舊版的 client 判定這是舊版伺服器，退回 initialize 流程
  const headerVersion = request.headers.get('MCP-Protocol-Version')
  if (headerVersion !== null && !SUPPORTED_PROTOCOL_VERSIONS.includes(headerVersion)) {
    return Response.json(
      { error: 'unsupported_protocol_version', supported: SUPPORTED_PROTOCOL_VERSIONS },
      { status: 400 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(rpcError(null, PARSE_ERROR, 'Parse error'), { status: 400 })
  }

  // 2025-03-26 允許批次（陣列），之後的版本只會送單一訊息，兩種都接受
  const messages: unknown[] = Array.isArray(body) ? body : [body]
  const isBatch = Array.isArray(body)
  if (messages.length === 0) {
    return Response.json(rpcError(null, INVALID_REQUEST, 'Invalid Request'), { status: 400 })
  }

  const responses: JsonRpcResponse[] = []
  for (const message of messages) {
    const response = await handleMessage(message, DB)
    if (response) {
      responses.push(response)
    }
  }

  // 全部都是通知：依規範回 202，沒有 body
  if (responses.length === 0) {
    return new Response(null, { status: 202 })
  }
  return Response.json(isBatch ? responses : responses[0])
}
