import type { Env } from '../../../../../types'
import { jsonError, jsonSuccess } from '../../../../../utils/http'
import { ackThumbnailTask } from '../../../../../services/taskService'

interface ThumbnailAckRequestBody {
  status?: unknown
  successAssetIds?: unknown
  failedAssetIds?: unknown
  error?: unknown
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

/**
 * POST /api/internal/tasks/thumbnail/:task_id/ack
 *
 * 內部 API，供地端 THUMBNAIL Worker 呼叫，不套用 Bearer 使用者驗證（Zero Trust 設定尚未導入）。
 *
 * 接受兩種 body 格式：
 *   業務成功（含全部失敗）：{ status: "SUCCESS", successAssetIds: [...], failedAssetIds: [...] }
 *   Worker 執行例外（還沒進入逐一處理迴圈）：{ status: "FAILED", error: "..." }
 *
 * 成功處理後回傳 { success: true }，不含 data。
 */
export const onRequestPost: PagesFunction<Env, 'task_id'> = async (context) => {
  const taskId = String(context.params.task_id)

  let body: ThumbnailAckRequestBody
  try {
    body = await context.request.json()
  } catch {
    return jsonError('Invalid JSON body', 400)
  }

  if (body.status !== 'SUCCESS' && body.status !== 'FAILED') {
    return jsonError('status must be SUCCESS or FAILED', 400)
  }

  try {
    await ackThumbnailTask(
      taskId,
      {
        status: body.status,
        successAssetIds: toStringArray(body.successAssetIds),
        failedAssetIds: toStringArray(body.failedAssetIds),
      },
      context.env.DB,
    )
    return jsonSuccess()
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
