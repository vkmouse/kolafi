// MIGRATION-TEMPORARY：資料搬遷用暫時 repository，雙邊資料筆數比對一致後應整支移除。

import type { MigrationTableConfig } from '../services/migrationDbService'

export async function countMigrationRows(config: MigrationTableConfig, DB: D1Database): Promise<number> {
  const sql = `SELECT COUNT(*) AS c FROM ${config.sqlTable}`
  const row = await DB.prepare(sql).first<{ c: number }>()
  return row?.c ?? 0
}

export interface MigrationListPage {
  rows: Record<string, unknown>[]
  totalFromWindow: number | undefined
}

// COUNT(*) OVER() 讓總筆數跟這頁資料共用一次查詢，避免多打一次 COUNT。
// 查無資料列時（例如頁碼超出範圍）window function 也帶不出總數，回傳 undefined。
export async function listMigrationRowsWithTotal(config: MigrationTableConfig, limit: number, offset: number, DB: D1Database): Promise<MigrationListPage> {
  const columnList = config.columns.map((c) => c.name).join(', ')
  const orderByList = config.orderBy.map((c) => `${c} ASC`).join(', ')
  const sql = `SELECT ${columnList}, COUNT(*) OVER() AS __total FROM ${config.sqlTable} ORDER BY ${orderByList} LIMIT ? OFFSET ?`
  const { results } = await DB.prepare(sql)
    .bind(limit, offset)
    .all<Record<string, unknown>>()

  const rawRows = results ?? []
  if (rawRows.length === 0) {
    return { rows: [], totalFromWindow: undefined }
  }

  const totalFromWindow = Number(rawRows[0].__total)
  const rows = rawRows.map(({ __total, ...rest }) => rest)
  return { rows, totalFromWindow }
}

// OR IGNORE：違反唯一鍵約束時靜默不寫入，不中斷同批其他陳述式。
export function buildMigrationInsertOrIgnoreStatement(config: MigrationTableConfig, row: Record<string, unknown>, DB: D1Database): D1PreparedStatement {
  const columnNames = config.columns.map((c) => c.name)
  const placeholders = columnNames.map(() => '?').join(', ')
  const sql = `INSERT OR IGNORE INTO ${config.sqlTable} (${columnNames.join(', ')}) VALUES (${placeholders})`
  return DB.prepare(sql).bind(...columnNames.map((name) => row[name]))
}
