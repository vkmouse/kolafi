import type { CreateTagBody, Env } from '../types'
import { createTag, getTagList } from '../services/tagService'
import { jsonError, jsonOk } from '../utils/http'
import { isNonEmptyString } from '../utils/validators'

/** GET /api/tags — 取得所有全域標籤，不需要使用者驗證、不需要專案存取驗證 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const data = await getTagList(context.env.DB)
    return jsonOk(data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}

/** POST /api/tags — 新增全域標籤，不需要使用者驗證、不需要專案存取驗證 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: CreateTagBody
  try {
    body = (await context.request.json()) as CreateTagBody
  } catch {
    return jsonError('標籤名稱不能為空', 400)
  }

  if (!isNonEmptyString(body.name)) {
    return jsonError('標籤名稱不能為空', 400)
  }

  try {
    const result = await createTag(body.name, context.env.DB)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    return jsonOk(result.data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
