import type { Env } from '../../../../../types'
import { jsonError, jsonSuccess } from '../../../../../utils/http'
import { ackDownloadTask } from '../../../../../services/taskService'
import { notifyWorker } from '../../../../../services/notifyService'

interface DownloadAckAssetBody {
  id?: unknown
  extension?: unknown
}

interface DownloadAckRequestBody {
  status?: unknown
  assets?: unknown
  error?: unknown
}

function toAssetDtos(value: unknown): { id: string; extension: string }[] {
  if (!Array.isArray(value)) return []
  const assets: { id: string; extension: string }[] = []
  for (const item of value as DownloadAckAssetBody[]) {
    if (!item || typeof item.id !== 'string' || typeof item.extension !== 'string') continue
    assets.push({ id: item.id, extension: item.extension })
  }
  return assets
}

/**
 * POST /api/internal/tasks/download/:task_id/ack
 *
 * 內部 API，供地端 DOWNLOAD Worker 呼叫，不套用 Bearer 使用者驗證（Zero Trust 設定尚未導入）。
 *
 * 接受兩種 body 格式：
 *   成功：{ status: "SUCCESS", assets: [ { id: "...", extension: ".jpg" }, ... ] }（至少 1 筆）
 *   失敗：{ status: "FAILED", error: "..." }
 *
 * 成功處理後回傳 { success: true }，不含 data。
 */
export const onRequestPost: PagesFunction<Env, 'task_id'> = async (context) => {
  const taskId = String(context.params.task_id)

  let body: DownloadAckRequestBody
  try {
    body = await context.request.json()
  } catch {
    return jsonError('Invalid JSON body', 400)
  }

  if (body.status !== 'SUCCESS' && body.status !== 'FAILED') {
    return jsonError('status must be SUCCESS or FAILED', 400)
  }

  const assets = body.status === 'SUCCESS' ? toAssetDtos(body.assets) : []

  if (body.status === 'SUCCESS' && assets.length === 0) {
    return jsonError('assets is required when status is SUCCESS', 400)
  }

  try {
    const result = await ackDownloadTask(
      taskId,
      {
        status: body.status,
        assets,
      },
      context.env.DB,
    )
    if (result.notifyThumbnail) {
      await notifyWorker(context.env.WORKER_NOTIFY_URL, 'THUMBNAIL')
    }
    return jsonSuccess()
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
