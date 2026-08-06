import type { CreateDownloadTaskBody, Env } from '../../types'
import { listDownloadTasks, createDownloadTask } from '../../services/taskListService'
import { notifyWorker } from '../../services/notifyService'
import { jsonError, jsonOk, jsonSuccess } from '../../utils/http'
import { isNonEmptyString } from '../../utils/validators'

/** GET /api/tasks/download — 取得指定專案的 DOWNLOAD 任務清單，不需要任何驗證 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const projectId = new URL(context.request.url).searchParams.get('project_id')
  if (!isNonEmptyString(projectId)) {
    return jsonError('缺少必要參數: project_id', 400)
  }

  try {
    const data = await listDownloadTasks(projectId, context.env.DB)
    return jsonOk(data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}

/** POST /api/tasks/download — 於指定專案建立一筆 DOWNLOAD 任務，不需要任何驗證 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: CreateDownloadTaskBody
  try {
    body = (await context.request.json()) as CreateDownloadTaskBody
  } catch {
    return jsonError('無效的請求資料', 400)
  }

  if (!isNonEmptyString(body.project_id)) {
    return jsonError('缺少必要參數: project_id', 400)
  }

  try {
    const result = await createDownloadTask(body.project_id, context.env.DB)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    await notifyWorker(context.env.WORKER_NOTIFY_URL, 'DOWNLOAD')
    return jsonSuccess()
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
