import type { Env } from '../../../../../types'
import { jsonError, jsonSuccess } from '../../../../../utils/http'
import { ackTagTask } from '../../../../../services/taskService'

interface TagAckRequestBody {
  status?: unknown
  keywords?: unknown
  error?: unknown
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

/**
 * POST /api/internal/tasks/tag/:task_id/ack
 *
 * 內部 API，供地端 TAG Worker 呼叫，不套用 Bearer 使用者驗證（Zero Trust 設定尚未導入）。
 *
 * 接受兩種 body 格式：
 *   成功：{ status: "SUCCESS", keywords: ["關鍵詞1", "關鍵詞2", ...] }
 *   失敗：{ status: "FAILED", error: "..." }
 *
 * 成功處理後回傳 { success: true }，不含 data。
 */
export const onRequestPost: PagesFunction<Env, 'task_id'> = async (context) => {
  const taskId = String(context.params.task_id)

  let body: TagAckRequestBody
  try {
    body = await context.request.json()
  } catch {
    return jsonError('Invalid JSON body', 400)
  }

  if (body.status !== 'SUCCESS' && body.status !== 'FAILED') {
    return jsonError('status must be SUCCESS or FAILED', 400)
  }

  if (body.status === 'SUCCESS' && toStringArray(body.keywords).length === 0) {
    return jsonError('keywords is required when status is SUCCESS', 400)
  }

  try {
    await ackTagTask(
      taskId,
      {
        status: body.status,
        keywords: body.status === 'SUCCESS' ? toStringArray(body.keywords) : [],
      },
      context.env.DB,
    )
    return jsonSuccess()
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
