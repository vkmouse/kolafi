import type { Env } from '../../types'
import { listCleanupTasks, createCleanupTask } from '../../services/taskListService'
import { notifyWorker } from '../../services/notifyService'
import { jsonError, jsonOk, jsonSuccess } from '../../utils/http'

/** GET /api/tasks/cleanup — 取得所有 CLEANUP 任務，不分專案，不需要任何驗證 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const data = await listCleanupTasks(context.env.DB)
    return jsonOk(data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}

/** POST /api/tasks/cleanup — 建立一筆 CLEANUP 任務，不需要 body，不需要任何驗證 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    await createCleanupTask(context.env.DB)
    await notifyWorker(context.env.KOLAFI_WORKER_BASE_URL, 'CLEANUP', { clientId: context.env.KOLAFI_WORKER_CF_ACCESS_CLIENT_ID, clientSecret: context.env.KOLAFI_WORKER_CF_ACCESS_CLIENT_SECRET })
    return jsonSuccess()
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
