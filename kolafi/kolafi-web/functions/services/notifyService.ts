/**
 * 建立任務（INSERT INTO tasks）後，主動通知 kolafi-worker 對應任務類型的背景迴圈，
 * 縮短「新任務要等最多 10 分鐘保底輪詢才被發現」的延遲。
 *
 * best-effort 加速手段，不是必要流程：通知失敗（連線失敗、逾時、worker 沒回應等）
 * 只記 log，不拋出例外、不重試，不影響呼叫端「建立任務」本身的成功回應——
 * 即使完全沒送達，worker 本來就有保底輪詢兜底。
 *
 * kolafi-worker 端路由的 task_type 是小寫（thumbnail/cleanup/...），跟 kolafi-web
 * 這邊 tasks.type 欄位慣用的大寫字串（THUMBNAIL 等）不同，這裡負責轉換。
 *
 * 刻意不 import `Env`：baseUrl 由呼叫端（API 層）從 `context.env.WORKER_NOTIFY_URL`
 * 取出後當參數傳入，避免整包 `context.env` 被傳進業務邏輯層。
 */

export type TaskType = 'THUMBNAIL' | 'CLEANUP' | 'CAPTION' | 'EXPORT' | 'TAG' | 'DOWNLOAD'

export async function notifyWorker(baseUrl: string | undefined, taskType: TaskType): Promise<void> {
  const normalizedBaseUrl = baseUrl?.replace(/\/+$/, '')
  if (!normalizedBaseUrl) {
    console.error('[notifyWorker] 缺少 WORKER_NOTIFY_URL，略過通知（worker 仍會靠保底輪詢處理任務）')
    return
  }

  const url = `${normalizedBaseUrl}/notify/${taskType.toLowerCase()}`

  try {
    const res = await fetch(url, { method: 'POST' })
    if (!res.ok) {
      console.error(`[notifyWorker] 通知 ${taskType} 失敗，status=${res.status}`)
    }
  } catch (err) {
    console.error(`[notifyWorker] 通知 ${taskType} 發生例外：`, err)
  }
}
