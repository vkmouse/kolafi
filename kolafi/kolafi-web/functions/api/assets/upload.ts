import type { Env } from '../../types'
import { uploadAsset } from '../../services/assetService'
import { notifyWorker } from '../../services/notifyService'
import { jsonError, jsonOk } from '../../utils/http'

/** POST /api/assets/upload — 上傳素材（multipart/form-data，欄位 file），不需要使用者驗證、不需要專案存取驗證 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  let formData: FormData
  try {
    formData = await context.request.formData()
  } catch {
    return jsonError('未選擇檔案', 400)
  }

  const file = formData.get('file')
  // formData.get 對缺少的欄位回傳 null；型別不是 File（例如被當成一般文字欄位送出）也視為未選擇檔案
  if (!(file instanceof File) || !file.name) {
    return jsonError('未選擇檔案', 400)
  }

  try {
    const result = await uploadAsset(file, context.env.DB, context.env)
    if (!result.ok) {
      return jsonError(result.error, 400)
    }
    await notifyWorker(context.env.WORKER_NOTIFY_URL, 'THUMBNAIL')
    return jsonOk(result.data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
