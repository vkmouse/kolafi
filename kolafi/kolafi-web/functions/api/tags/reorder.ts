import type { Env, ReorderTagsBody } from '../../types'
import { reorderTags } from '../../services/tagService'
import { jsonError, jsonSuccess } from '../../utils/http'

/** PUT /api/tags/reorder — 重新排序所有標籤，不需要使用者驗證、不需要專案存取驗證 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  let body: ReorderTagsBody
  try {
    body = (await context.request.json()) as ReorderTagsBody
  } catch {
    return jsonError('缺少必要欄位: tag_ids', 400)
  }

  if (!Array.isArray(body.tag_ids)) {
    return jsonError('缺少必要欄位: tag_ids', 400)
  }

  try {
    await reorderTags(body.tag_ids as string[], context.env.DB)
    return jsonSuccess()
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
