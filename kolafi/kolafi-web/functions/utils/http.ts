/** 統一的 API 回應信封 { success, data?, error?, pagination? }，含驗證層在內全站共用（OAuth 協定端點除外，見 jsonOAuthError） */

export function jsonOk(data: unknown, init?: ResponseInit): Response {
  return Response.json({ success: true, data }, init)
}

export function jsonOkPaginated(
  data: unknown,
  pagination: { page: number; page_size: number; total: number; total_pages: number },
  init?: ResponseInit,
): Response {
  return Response.json({ success: true, data, pagination }, init)
}

/** GET /api/assets 專用信封：{ success, data, has_more, page }，跟 jsonOkPaginated 的 { pagination } 不同 */
export function jsonOkInfiniteScroll(data: unknown, hasMore: boolean, page: number, init?: ResponseInit): Response {
  return Response.json({ success: true, data, has_more: hasMore, page }, init)
}

export function jsonError(error: string, status: number): Response {
  return Response.json({ success: false, error }, { status })
}

/** 成功但沒有 data 可回傳的端點，如 PUT /api/tags/reorder */
export function jsonSuccess(init?: ResponseInit): Response {
  return Response.json({ success: true }, init)
}

/** 部分端點（如 DELETE /api/assets/:asset_id）成功時回傳 { success, message } 而非 { success, data } */
export function jsonMessage(message: string, init?: ResponseInit): Response {
  return Response.json({ success: true, message }, init)
}

/**
 * OAuth 端點（/api/register、/api/authorize、/api/token）專用的錯誤回應。呼叫者是第三方
 * 網站，協定規定錯誤要長 `{ error: <標準錯誤碼> }`，所以不用上面的 { success, error } 信封；
 * 這幾個端點成功時也直接回傳協定規定的欄位，不包 { success, data }。
 */
export function jsonOAuthError(error: string, status = 400): Response {
  return Response.json({ error }, { status })
}
