import type { Env } from '../../../../types'
import { jsonError, jsonOk } from '../../../../utils/http'
import { pullCaptionTask } from '../../../../services/taskService'

/**
 * POST /api/internal/tasks/caption/pull
 *
 * 內部 API，供地端 CAPTION Worker 呼叫，不套用 X-User-Id 操作歸屬標記（Zero Trust 設定尚未導入）。
 *
 * 回應信封：
 *   有任務：{ success: true, data: { taskId, payload: { projectName, captionConfigs } } }
 *   沒有 PENDING 任務可拿：{ success: true, data: null }（正常情況，不是錯誤）
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const result = await pullCaptionTask(context.env.DB)
    return jsonOk(result)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
