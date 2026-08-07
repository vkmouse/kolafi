import type { Env } from '../../types'
import { resolveActingUser } from '../../middleware/actorContext'
import { getProjectStats } from '../../services/projectService'
import { jsonError, jsonOk } from '../../utils/http'

/** GET /api/projects/stats — 取得目前使用者的專案統計數據（依狀態分組計數），只套用第 1 層使用者驗證 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = await resolveActingUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response

  try {
    const stats = await getProjectStats(auth.userId, context.env.DB)
    return jsonOk(stats)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
