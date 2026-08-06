import type { Env } from '../types'
import { getExportProjectId } from '../repositories/exportRepository'
import { exportKey, getObject } from '../utils/storage'

export type ExportFileResult =
  | { ok: true; body: ReadableStream<Uint8Array>; filename: string }
  | { ok: false; error: string; status: number }

/** 不套用任何驗證機制：只要知道 export_id，任何人都能讀取 */
export async function getExportFile(exportId: string, DB: D1Database, env: Env): Promise<ExportFileResult> {
  const projectId = await getExportProjectId(exportId, DB)
  if (!projectId) {
    return { ok: false, error: '匯出檔案不存在', status: 404 }
  }

  const filename = `export_${exportId}.mp4`
  const key = exportKey(projectId, exportId)
  const object = await getObject(env, key)
  if (!object) {
    return { ok: false, error: '匯出檔案不存在', status: 404 }
  }

  return { ok: true, body: object.body, filename }
}
