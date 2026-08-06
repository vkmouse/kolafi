import type { ProjectTagDto } from '../types'
import { projectExists } from '../repositories/projectRepository'
import {
  getNextProjectTagSortOrder,
  getProjectTagById,
  insertProjectTag,
  listProjectTags,
  projectTagNameExists,
  updateProjectTagIsSelected,
  updateProjectTagSortOrder,
  type ProjectTagRow,
} from '../repositories/projectTagRepository'
import { isValidUuid } from '../utils/validators'

export async function getProjectTagList(projectId: string, DB: D1Database): Promise<ProjectTagDto[]> {
  const rows = await listProjectTags(projectId, DB)
  return rows.map(rowToDto)
}

export type CreateProjectTagResult = { ok: true; data: ProjectTagDto } | { ok: false; error: string; status: number }

export async function createProjectTag(projectId: string, name: string, DB: D1Database): Promise<CreateProjectTagResult> {
  if (!(await projectExists(projectId, DB))) {
    return { ok: false, error: '專案不存在', status: 404 }
  }
  if (await projectTagNameExists(projectId, name, DB)) {
    return { ok: false, error: '標籤已存在', status: 400 }
  }

  const id = crypto.randomUUID()
  const sortOrder = await getNextProjectTagSortOrder(projectId, DB)
  const createdAt = Date.now()
  await insertProjectTag(id, projectId, name, sortOrder, createdAt, DB)

  const row = await getProjectTagById(id, projectId, DB)
  return { ok: true, data: rowToDto(row as ProjectTagRow) }
}

export type UpdateProjectTagSelectResult = { ok: true; data: ProjectTagDto } | { ok: false; error: string; status: number }

export async function updateProjectTagSelected(
  projectId: string,
  tagId: string,
  isSelected: boolean,
  DB: D1Database,
): Promise<UpdateProjectTagSelectResult> {
  const row = await getProjectTagById(tagId, projectId, DB)
  if (!row) {
    return { ok: false, error: '標籤不存在', status: 404 }
  }

  await updateProjectTagIsSelected(tagId, projectId, isSelected, DB)
  const updated = await getProjectTagById(tagId, projectId, DB)
  return { ok: true, data: rowToDto(updated as ProjectTagRow) }
}

export type ReorderProjectTagsResult = { ok: true } | { ok: false; error: string; status: number }

/** 非合法 UUID 的元素靜默略過；逐筆 UPDATE 非交易式，中途失敗不會回滾已寫入的部分 */
export async function reorderProjectTags(projectId: string, tagIds: string[], DB: D1Database): Promise<ReorderProjectTagsResult> {
  if (!(await projectExists(projectId, DB))) {
    return { ok: false, error: '專案不存在', status: 404 }
  }

  for (let index = 0; index < tagIds.length; index++) {
    const id = tagIds[index]
    if (!isValidUuid(id)) continue
    await updateProjectTagSortOrder(id, projectId, index, DB)
  }

  return { ok: true }
}

function rowToDto(row: ProjectTagRow): ProjectTagDto {
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    is_selected: row.is_selected === 1,
    sort_order: row.sort_order,
    created_at: new Date(row.created_at).toISOString(),
  }
}
