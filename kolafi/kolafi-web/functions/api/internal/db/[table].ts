/**
 * MIGRATION-TEMPORARY
 *
 * GET /api/internal/db/{table} — 整批讀取（含分頁、count_only 精簡模式）。
 * 依《kolafi-web 新增 API 規格書（資料搬遷用內部端點）》第 4.2、5 節實作。
 * 不套用應用層身分驗證，邊界防護在 Cloudflare Access（見 ../../_middleware.ts 的 SKIP_AUTH_PREFIXES）。
 *
 * 搬遷完成且雙邊資料比對無誤後，應整支刪除本檔案，以及所有標記 MIGRATION-TEMPORARY 的檔案。
 */
import type { Env } from '../../../types'
import { jsonError, jsonOk, jsonOkInfiniteScroll } from '../../../utils/http'
import { getMigrationCount, getMigrationList, getMigrationTableConfig, parseMigrationPageParam } from '../../../services/migrationDbService'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const table = context.params.table as string
  const config = getMigrationTableConfig(table)
  if (!config) {
    return jsonError(`找不到資料類型: ${table}`, 404)
  }

  const url = new URL(context.request.url)
  const countOnly = url.searchParams.get('count_only') === 'true'

  try {
    // count_only=true 時 page 完全被忽略，不驗證、不影響回應（規格書 4.2 節）
    if (countOnly) {
      const count = await getMigrationCount(config, context.env.DB)
      return jsonOk({ table, count })
    }

    const pageResult = parseMigrationPageParam(url.searchParams.get('page'))
    if (!pageResult.ok) {
      return jsonError(pageResult.error, 400)
    }

    const { count, rows, hasMore } = await getMigrationList(config, pageResult.value, context.env.DB)
    return jsonOkInfiniteScroll({ table, count, rows }, hasMore, pageResult.value)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500)
  }
}
