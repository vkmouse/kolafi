/** 統一的 API 回應信封 { success, data?, error?, pagination? }，含驗證層在內全站共用 */

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
