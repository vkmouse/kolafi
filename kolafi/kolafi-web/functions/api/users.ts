import type { Env } from '../types'
import { getUserList } from '../services/userService'
import { jsonError, jsonOk } from '../utils/http'

/** GET /api/users — 取得所有使用者清單，不需要使用者驗證、不需要專案存取驗證 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const data = await getUserList(context.env.DB)
    return jsonOk(data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
