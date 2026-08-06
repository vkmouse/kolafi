import type { Env } from '../../../types'
import { getExportFile } from '../../../services/exportService'
import { jsonError } from '../../../utils/http'
import { isValidUuid } from '../../../utils/validators'

/** GET /api/exports/:export_id/file — 代理讀取匯出影片，不需要使用者驗證、不需要專案存取驗證，成功時回傳影片二進位內容（非 JSON 信封） */
export const onRequestGet: PagesFunction<Env, 'export_id'> = async (context) => {
  const exportId = String(context.params.export_id)
  if (!isValidUuid(exportId)) {
    return jsonError('Invalid export ID', 400)
  }

  try {
    const result = await getExportFile(exportId, context.env.DB, context.env)
    if (!result.ok) {
      return jsonError(result.error, result.status)
    }

    return new Response(result.body, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    })
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
