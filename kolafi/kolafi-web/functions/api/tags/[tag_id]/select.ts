import type { UpdateTagSelectBody, Env } from '../../../types'
import { updateTagSelected } from '../../../services/tagService'
import { jsonError, jsonOk } from '../../../utils/http'
import { isValidUuid } from '../../../utils/validators'

/** PUT /api/tags/:tag_id/select — 更新標籤選擇狀態，不需要使用者驗證、不需要專案存取驗證 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const tagId = context.params.tag_id as string

  if (!isValidUuid(tagId)) {
    return jsonError('Invalid tag ID', 400)
  }

  let body: UpdateTagSelectBody
  try {
    body = (await context.request.json()) as UpdateTagSelectBody
  } catch {
    return jsonError('缺少必要欄位: is_selected', 400)
  }

  const isSelected = body.is_selected === true

  try {
    const result = await updateTagSelected(tagId, isSelected, context.env.DB)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    return jsonOk(result.data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
