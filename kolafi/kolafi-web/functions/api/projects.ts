import type { Env, CreateProjectBody } from '../types'
import { resolveActingUser } from '../middleware/actorContext'
import { createProject, getProjectList, parseListProjectsQuery } from '../services/projectService'
import { jsonError, jsonOk, jsonOkPaginated } from '../utils/http'

/** GET /api/projects — 取得目前使用者的專案清單（分頁、可篩選、可搜尋） */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = await resolveActingUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response

  const url = new URL(context.request.url)
  const query = parseListProjectsQuery(url.searchParams)

  try {
    const { data, pagination } = await getProjectList(auth.userId, query, context.env.DB)
    return jsonOkPaginated(data, pagination)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}

/** POST /api/projects — 建立新專案，並自動與所有使用者建立 user_projects 關聯 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await resolveActingUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response
  // auth.userId 刻意不用在後續寫入邏輯：新建立的專案會跟系統內所有使用者建立關聯，不只發出請求的這位

  let body: CreateProjectBody
  try {
    body = (await context.request.json()) as CreateProjectBody
  } catch {
    return jsonError('缺少必要欄位: name', 400)
  }

  try {
    const result = await createProject(body, context.env.DB)
    if (!result.ok) {
      return jsonError(result.error, 400)
    }
    return jsonOk(result.data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
