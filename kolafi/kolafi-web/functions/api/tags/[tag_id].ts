import type { Env } from '../../types'
import { deleteTag } from '../../services/tagService'
import { jsonError, jsonSuccess } from '../../utils/http'
import { isValidUuid } from '../../utils/validators'

/** DELETE /api/tags/:tag_id — 刪除標籤，不需要使用者驗證、不需要專案存取驗證 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const tagId = context.params.tag_id as string

  if (!isValidUuid(tagId)) {
    return jsonError('Invalid tag ID', 400)
  }

  try {
    const result = await deleteTag(tagId, context.env.DB)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    return jsonSuccess()
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
