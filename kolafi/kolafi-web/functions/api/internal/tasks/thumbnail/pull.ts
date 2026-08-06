import type { Env } from '../../../../types'
import { jsonError, jsonOk } from '../../../../utils/http'
import { pullThumbnailTask } from '../../../../services/taskService'

/**
 * POST /api/internal/tasks/thumbnail/pull
 *
 * 內部 API，供地端 THUMBNAIL Worker 呼叫，不套用 Bearer 使用者驗證（Zero Trust 設定尚未導入）。
 *
 * 回應信封：
 *   有任務：{ success: true, data: { taskId, payload: { assets: [...] } } }
 *   沒有 PENDING 任務可拿：{ success: true, data: null }（正常情況，不是錯誤）
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const result = await pullThumbnailTask(context.env.DB)
    return jsonOk(result)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
