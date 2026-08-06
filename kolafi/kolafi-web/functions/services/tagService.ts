import type { TagDto } from '../types'
import {
  deleteTagById,
  getNextSortOrder,
  getTagById,
  insertTag,
  listTags,
  tagNameExists,
  updateTagIsSelected,
  updateTagSortOrder,
  type TagRow,
} from '../repositories/tagRepository'
import { isValidUuid } from '../utils/validators'

export async function getTagList(DB: D1Database): Promise<TagDto[]> {
  const rows = await listTags(DB)
  return rows.map(rowToDto)
}

export type CreateTagResult = { ok: true; data: TagDto } | { ok: false; error: string; status: number }

export async function createTag(name: string, DB: D1Database): Promise<CreateTagResult> {
  if (await tagNameExists(name, DB)) {
    return { ok: false, error: '標籤已存在', status: 400 }
  }

  const id = crypto.randomUUID()
  const sortOrder = await getNextSortOrder(DB)
  const createdAt = Date.now()
  await insertTag(id, name, sortOrder, createdAt, DB)

  const row = await getTagById(id, DB)
  return { ok: true, data: rowToDto(row as TagRow) }
}

/** 非合法 UUID 的元素靜默略過；逐筆 UPDATE 非交易式，中途失敗不會回滾已寫入的部分 */
export async function reorderTags(tagIds: string[], DB: D1Database): Promise<void> {
  for (let index = 0; index < tagIds.length; index++) {
    const id = tagIds[index]
    if (!isValidUuid(id)) continue
    await updateTagSortOrder(id, index, DB)
  }
}

export type UpdateTagSelectResult = { ok: true; data: TagDto } | { ok: false; error: string; status: number }

export async function updateTagSelected(id: string, isSelected: boolean, DB: D1Database): Promise<UpdateTagSelectResult> {
  const row = await getTagById(id, DB)
  if (!row) {
    return { ok: false, error: '標籤不存在', status: 404 }
  }

  await updateTagIsSelected(id, isSelected, DB)
  const updated = await getTagById(id, DB)
  return { ok: true, data: rowToDto(updated as TagRow) }
}

export async function deleteTag(id: string, DB: D1Database): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const row = await getTagById(id, DB)
  if (!row) {
    return { ok: false, error: '標籤不存在', status: 404 }
  }

  await deleteTagById(id, DB)
  return { ok: true }
}

/** created_at 對外統一轉成 ISO 8601 字串；DB 內實際存的是 epoch ms（跟 AssetDto 不同,那邊維持數字） */
function rowToDto(row: TagRow): TagDto {
  return {
    id: row.id,
    name: row.name,
    is_selected: row.is_selected === 1,
    sort_order: row.sort_order,
    created_at: new Date(row.created_at).toISOString(),
  }
}
