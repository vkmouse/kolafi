import type { Env } from '../../../../types'
import { authenticateUser, authenticateProjectAccess } from '../../../../middleware/authMiddleware'
import { uploadAssetToProject } from '../../../../services/projectAssetService'
import { notifyWorker } from '../../../../services/notifyService'
import { jsonError, jsonOk } from '../../../../utils/http'

/** POST /api/projects/:project_id/assets/upload — 直接上傳新檔案並建立為專案素材（multipart/form-data，欄位 file） */
export const onRequestPost: PagesFunction<Env, 'project_id'> = async (context) => {
  const auth = await authenticateUser(context.request, context.env.DB)
  if (!auth.ok) return auth.response

  const projectAuth = await authenticateProjectAccess(String(context.params.project_id), auth.userId, context.env.DB)
  if (!projectAuth.ok) return projectAuth.response

  let formData: FormData
  try {
    formData = await context.request.formData()
  } catch {
    return jsonError('未選擇檔案', 400)
  }

  const file = formData.get('file')
  // formData.get 對缺少的欄位回傳 null；型別不是 File 也視為未選擇檔案
  if (!(file instanceof File) || !file.name) {
    return jsonError('未選擇檔案', 400)
  }

  try {
    const result = await uploadAssetToProject(projectAuth.projectId, file, context.env.DB, context.env)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }
    await notifyWorker(context.env.KOLAFI_WORKER_BASE_URL, 'THUMBNAIL', { clientId: context.env.KOLAFI_WORKER_CF_ACCESS_CLIENT_ID, clientSecret: context.env.KOLAFI_WORKER_CF_ACCESS_CLIENT_SECRET })
    return jsonOk(result.data)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
