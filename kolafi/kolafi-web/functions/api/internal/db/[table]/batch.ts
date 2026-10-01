/**
 * MIGRATION-TEMPORARY
 *
 * POST /api/internal/db/{table}/batch — 整批寫入。
 * 依《kolafi-web 新增 API 規格書（資料搬遷用內部端點）》第 4.1、6 節實作。
 * 不套用應用層身分驗證，邊界防護在 Cloudflare Access（見 ../../../_middleware.ts 的 SKIP_AUTH_PREFIXES）。
 *
 * 搬遷完成且雙邊資料比對無誤後，應整支刪除本檔案，以及所有標記 MIGRATION-TEMPORARY 的檔案。
 */
import type { Env } from '../../../../types'
import { jsonError, jsonOk } from '../../../../utils/http'
import { batchWriteMigrationRows, getMigrationTableConfig, MIGRATION_BATCH_LIMIT } from '../../../../services/migrationDbService'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const table = context.params.table as string
  const config = getMigrationTableConfig(table)
  if (!config) {
    return jsonError(`找不到資料類型: ${table}`, 404)
  }

  let body: unknown
  try {
    body = await context.request.json()
  } catch {
    return jsonError('請求主體必須是合法 JSON 陣列', 400)
  }

  if (!Array.isArray(body)) {
    return jsonError('請求主體必須是 JSON 陣列', 400)
  }

  if (body.length > MIGRATION_BATCH_LIMIT) {
    return jsonError(`單批筆數不可超過 ${MIGRATION_BATCH_LIMIT} 筆`, 400)
  }

  try {
    const result = await batchWriteMigrationRows(config, body, context.env.DB)
    return jsonOk({
      received: result.received,
      inserted: result.inserted,
      skipped_conflict: result.skippedConflict,
      invalid_rows: result.invalidRows,
    })
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
