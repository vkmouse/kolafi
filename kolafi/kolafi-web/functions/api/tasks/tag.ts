import type { CreateTagTaskBody, Env } from '../../types'
import { listTagTasks, createTagTask } from '../../services/taskListService'
import { notifyWorker } from '../../services/notifyService'
import { jsonError, jsonOk, jsonSuccess } from '../../utils/http'
import { isNonEmptyString } from '../../utils/validators'

/** GET /api/tasks/tag — 取得指定專案的 TAG 任務清單，不需要任何驗證 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const projectId = new URL(context.request.url).searchParams.get('project_id')
  if (!isNonEmptyString(projectId)) {
    return jsonError('缺少必要參數: project_id', 400)
  }

  try {
    const data = await listTagTasks(projectId, context.env.DB)
    return jsonOk(data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}

/** POST /api/tasks/tag — 於指定專案建立一筆 TAG 任務，不需要任何驗證 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: CreateTagTaskBody
  try {
    body = (await context.request.json()) as CreateTagTaskBody
  } catch {
    return jsonError('無效的請求資料', 400)
  }

  if (!isNonEmptyString(body.project_id)) {
    return jsonError('缺少必要參數: project_id', 400)
  }

  try {
    const result = await createTagTask(body.project_id, context.env.DB)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    await notifyWorker(context.env.KOLAFI_WORKER_BASE_URL, 'TAG', { clientId: context.env.KOLAFI_WORKER_CF_ACCESS_CLIENT_ID, clientSecret: context.env.KOLAFI_WORKER_CF_ACCESS_CLIENT_SECRET })
    return jsonSuccess()
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
