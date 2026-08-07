import type { Env } from '../../types'
import { listThumbnailTasks, createThumbnailTask } from '../../services/taskListService'
import { notifyWorker } from '../../services/notifyService'
import { jsonError, jsonOk, jsonSuccess } from '../../utils/http'

/** GET /api/tasks/thumbnail — 取得所有 THUMBNAIL 任務，不分專案，不需要任何驗證 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const data = await listThumbnailTasks(context.env.DB)
    return jsonOk(data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}

/** POST /api/tasks/thumbnail — 建立一筆 THUMBNAIL 任務，不需要 body，不需要任何驗證 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    await createThumbnailTask(context.env.DB)
    await notifyWorker(context.env.KOLAFI_WORKER_BASE_URL, 'THUMBNAIL', { clientId: context.env.KOLAFI_WORKER_CF_ACCESS_CLIENT_ID, clientSecret: context.env.KOLAFI_WORKER_CF_ACCESS_CLIENT_SECRET })
    return jsonSuccess()
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
