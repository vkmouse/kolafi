import type { Env } from '../../../../../types'
import { jsonError, jsonSuccess } from '../../../../../utils/http'
import { ackExportTask } from '../../../../../services/taskService'

interface ExportAckRequestBody {
  status?: unknown
  exportId?: unknown
  error?: unknown
}

/**
 * POST /api/internal/tasks/export/:task_id/ack
 *
 * 內部 API，供地端 EXPORT Worker 呼叫，不套用 X-User-Id 操作歸屬標記（Zero Trust 設定尚未導入）。
 *
 * 接受兩種 body 格式：
 *   成功：{ status: "SUCCESS", exportId: "..." }
 *   失敗：{ status: "FAILED", error: "..." }
 *
 * 成功處理後回傳 { success: true }，不含 data。
 */
export const onRequestPost: PagesFunction<Env, 'task_id'> = async (context) => {
  const taskId = String(context.params.task_id)

  let body: ExportAckRequestBody
  try {
    body = await context.request.json()
  } catch {
    return jsonError('Invalid JSON body', 400)
  }

  if (body.status !== 'SUCCESS' && body.status !== 'FAILED') {
    return jsonError('status must be SUCCESS or FAILED', 400)
  }

  try {
    await ackExportTask(
      taskId,
      {
        status: body.status,
        exportId: typeof body.exportId === 'string' ? body.exportId : undefined,
      },
      context.env.DB,
    )
    return jsonSuccess()
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
