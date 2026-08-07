import type { CreateCaptionTaskBody, Env } from '../../types'
import { resolveActingUser } from '../../middleware/actorContext'
import { listCaptionTasks, createCaptionTask } from '../../services/taskListService'
import { notifyWorker } from '../../services/notifyService'
import { jsonError, jsonOk, jsonSuccess } from '../../utils/http'
import { isNonEmptyString } from '../../utils/validators'

/**
 * GET /api/tasks/caption — 取得目前使用者、指定專案的 CAPTION 任務清單，需要第 1 層使用者驗證；
 * project_id 是 query 參數而非路徑參數，不觸發第 2 層專案存取驗證。
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = await resolveActingUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response

  const projectId = new URL(context.request.url).searchParams.get('project_id')
  if (!isNonEmptyString(projectId)) {
    return jsonError('缺少必要參數: project_id', 400)
  }

  try {
    const data = await listCaptionTasks(projectId, auth.userId, context.env.DB)
    return jsonOk(data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}

/** POST /api/tasks/caption — 為目前使用者、指定專案建立一筆 CAPTION 任務，需要第 1 層使用者驗證 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await resolveActingUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response

  let body: CreateCaptionTaskBody
  try {
    body = (await context.request.json()) as CreateCaptionTaskBody
  } catch {
    return jsonError('無效的請求資料', 400)
  }

  if (!isNonEmptyString(body.project_id)) {
    return jsonError('缺少必要參數: project_id', 400)
  }

  try {
    const result = await createCaptionTask(body.project_id, auth.userId, context.env.DB)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    await notifyWorker(context.env.KOLAFI_WORKER_BASE_URL, 'CAPTION', { clientId: context.env.KOLAFI_WORKER_CF_ACCESS_CLIENT_ID, clientSecret: context.env.KOLAFI_WORKER_CF_ACCESS_CLIENT_SECRET })
    return jsonSuccess()
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
