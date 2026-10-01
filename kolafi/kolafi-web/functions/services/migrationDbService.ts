// MIGRATION-TEMPORARY：資料搬遷用暫時 service，雙邊資料筆數比對一致後應整支移除。

import {
  buildMigrationInsertOrIgnoreStatement,
  countMigrationRows,
  listMigrationRowsWithTotal,
} from '../repositories/migrationDbRepository'

export const MIGRATION_PAGE_SIZE = 500
export const MIGRATION_BATCH_LIMIT = 500

type ColumnType = 'text' | 'int' | 'int01' | 'enum'

interface MigrationColumnDef {
  name: string
  type: ColumnType
  enumValues?: readonly string[]
}

export interface MigrationTableConfig {
  table: string
  sqlTable: string
  columns: MigrationColumnDef[]
  // OR-of-AND：任一組所有欄位都符合既有資料即視為衝突。
  // 每一組都必須跟 sqlTable 的 PRIMARY KEY / UNIQUE 約束完全對應，
  // 衝突判斷才會正確地交給資料庫的 INSERT OR IGNORE 處理，而不是自己查一次。
  uniqueKeyGroups: string[][]
  orderBy: string[]
}

const STATUS_ENUM = ['DRAFT', 'PENDING', 'PUBLISHED'] as const

export const MIGRATION_TABLE_CONFIGS: Record<string, MigrationTableConfig> = {
  users: {
    table: 'users',
    sqlTable: 'users',
    columns: [
      { name: 'id', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'created_at', type: 'int' },
    ],
    uniqueKeyGroups: [['id']],
    orderBy: ['id'],
  },
  user_configs: {
    table: 'user_configs',
    sqlTable: 'user_configs',
    columns: [
      { name: 'id', type: 'text' },
      { name: 'user_id', type: 'text' },
      { name: 'config_name', type: 'text' },
      { name: 'data', type: 'text' },
      { name: 'created_at', type: 'int' },
    ],
    uniqueKeyGroups: [['id']],
    orderBy: ['id'],
  },
  tags: {
    table: 'tags',
    sqlTable: 'tags',
    columns: [
      { name: 'id', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'is_selected', type: 'int01' },
      { name: 'sort_order', type: 'int' },
      { name: 'created_at', type: 'int' },
    ],
    // id、name 任一重複都視為已存在，對應 schema 的 id PRIMARY KEY + name UNIQUE。
    uniqueKeyGroups: [['id'], ['name']],
    orderBy: ['id'],
  },
  assets: {
    table: 'assets',
    sqlTable: 'assets',
    columns: [
      { name: 'id', type: 'text' },
      { name: 'extension', type: 'text' },
      { name: 'type', type: 'text' },
      { name: 'source_type', type: 'text' },
      { name: 'source_id', type: 'text' },
      { name: 'created_at', type: 'int' },
      { name: 'has_thumbnail', type: 'int01' },
    ],
    uniqueKeyGroups: [['id']],
    orderBy: ['id'],
  },
  projects: {
    table: 'projects',
    sqlTable: 'projects',
    columns: [
      { name: 'id', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'created_at', type: 'int' },
    ],
    uniqueKeyGroups: [['id']],
    orderBy: ['id'],
  },
  project_assets: {
    table: 'project_assets',
    sqlTable: 'project_assets',
    columns: [
      { name: 'project_id', type: 'text' },
      { name: 'asset_id', type: 'text' },
      { name: 'is_selected', type: 'int01' },
      { name: 'sort_order', type: 'int' },
      { name: 'created_at', type: 'int' },
    ],
    uniqueKeyGroups: [['project_id', 'asset_id']],
    orderBy: ['project_id', 'asset_id'],
  },
  project_tags: {
    table: 'project_tags',
    sqlTable: 'project_tags',
    columns: [
      { name: 'id', type: 'text' },
      { name: 'project_id', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'is_selected', type: 'int01' },
      { name: 'sort_order', type: 'int' },
      { name: 'created_at', type: 'int' },
    ],
    uniqueKeyGroups: [['id']],
    orderBy: ['id'],
  },
  user_projects: {
    table: 'user_projects',
    sqlTable: 'user_projects',
    columns: [
      { name: 'user_id', type: 'text' },
      { name: 'project_id', type: 'text' },
      { name: 'status', type: 'enum', enumValues: STATUS_ENUM },
      { name: 'caption', type: 'text' },
      { name: 'export_params', type: 'text' },
      { name: 'created_at', type: 'int' },
    ],
    uniqueKeyGroups: [['user_id', 'project_id']],
    orderBy: ['user_id', 'project_id'],
  },
  project_exports: {
    table: 'project_exports',
    sqlTable: 'project_exports',
    columns: [
      { name: 'id', type: 'text' },
      { name: 'project_id', type: 'text' },
      { name: 'user_id', type: 'text' },
      { name: 'url', type: 'text' },
      { name: 'created_at', type: 'int' },
    ],
    uniqueKeyGroups: [['id']],
    orderBy: ['id'],
  },
}

export function getMigrationTableConfig(table: string): MigrationTableConfig | undefined {
  return MIGRATION_TABLE_CONFIGS[table]
}

// ---- 讀取 ----

export interface MigrationListResult {
  count: number
  rows: Record<string, unknown>[]
  hasMore: boolean
}

export async function getMigrationCount(config: MigrationTableConfig, DB: D1Database): Promise<number> {
  return countMigrationRows(config, DB)
}

export async function getMigrationList(config: MigrationTableConfig, page: number, DB: D1Database): Promise<MigrationListResult> {
  const offset = (page - 1) * MIGRATION_PAGE_SIZE
  const { rows, totalFromWindow } = await listMigrationRowsWithTotal(config, MIGRATION_PAGE_SIZE, offset, DB)

  // 頁碼超出範圍時上一步查不到總數，另外查一次。
  const count = totalFromWindow ?? (await countMigrationRows(config, DB))
  const hasMore = page * MIGRATION_PAGE_SIZE < count
  return { count, rows, hasMore }
}

export function parseMigrationPageParam(raw: string | null): { ok: true; value: number } | { ok: false; error: string } {
  if (raw === null) return { ok: true, value: 1 }
  if (!/^\d+$/.test(raw)) {
    return { ok: false, error: 'page 必須為大於等於 1 的整數' }
  }
  const value = Number(raw)
  if (value < 1) {
    return { ok: false, error: 'page 必須為大於等於 1 的整數' }
  }
  return { ok: true, value }
}

// ---- 寫入 ----

export interface InvalidRow {
  index: number
  reason: string
}

export interface MigrationBatchResult {
  received: number
  inserted: number
  skippedConflict: number
  invalidRows: InvalidRow[]
}

type RowValidation = { ok: true; row: Record<string, unknown> } | { ok: false; reason: string }

function validateMigrationRow(config: MigrationTableConfig, raw: unknown): RowValidation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: '資料格式錯誤，必須為物件' }
  }

  const source = raw as Record<string, unknown>
  const row: Record<string, unknown> = {}

  for (const col of config.columns) {
    const value = source[col.name]

    if (value === undefined || value === null) {
      return { ok: false, reason: `缺少必填欄位 ${col.name}` }
    }

    switch (col.type) {
      case 'text':
        if (typeof value !== 'string') {
          return { ok: false, reason: `${col.name} 必須為文字` }
        }
        row[col.name] = value
        break

      case 'int':
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          return { ok: false, reason: `${col.name} 必須為整數` }
        }
        row[col.name] = value
        break

      case 'int01':
        if (typeof value !== 'number' || !Number.isInteger(value) || (value !== 0 && value !== 1)) {
          return { ok: false, reason: `${col.name} 必須為 0 或 1` }
        }
        row[col.name] = value
        break

      case 'enum':
        if (typeof value !== 'string' || !col.enumValues?.includes(value)) {
          return { ok: false, reason: `${col.name} 必須為 ${col.enumValues?.join('/')} 其中之一` }
        }
        row[col.name] = value
        break
    }
  }

  return { ok: true, row }
}

// 唯一性判斷交給 INSERT OR IGNORE，不事先查詢已存在鍵值，把整批寫入壓到一次 round trip。
// 同批次內排序在後的資料若跟前面已寫入的資料衝突，也會在同一次 batch 裡被擋下，不需另外追蹤。
export async function batchWriteMigrationRows(config: MigrationTableConfig, rawRows: unknown[], DB: D1Database): Promise<MigrationBatchResult> {
  const invalidRows: InvalidRow[] = []
  const candidates: { index: number; row: Record<string, unknown> }[] = []

  rawRows.forEach((raw, index) => {
    const validation = validateMigrationRow(config, raw)
    if (!validation.ok) {
      invalidRows.push({ index, reason: validation.reason })
    } else {
      candidates.push({ index, row: validation.row })
    }
  })

  if (candidates.length === 0) {
    return { received: rawRows.length, inserted: 0, skippedConflict: 0, invalidRows }
  }

  const statements = candidates.map((c) => buildMigrationInsertOrIgnoreStatement(config, c.row, DB))
  const results = await DB.batch(statements)

  // changes===1 代表真的寫入；OR IGNORE 擋下衝突時 changes===0。
  let inserted = 0
  let skippedConflict = 0
  for (const result of results) {
    if (result.meta.changes === 1) {
      inserted++
    } else {
      skippedConflict++
    }
  }

  return { received: rawRows.length, inserted, skippedConflict, invalidRows }
}
