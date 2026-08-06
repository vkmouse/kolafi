/**
 * 前端 Tasks API 業務邏輯層。跟 `taskService.ts`（Internal Pull/Ack，供地端 Worker 呼叫）是完全不同的兩層，
 * 這裡只負責「新增一筆任務」與「查詢任務清單」，直接對 tasks 表做 INSERT／SELECT。
 */

import type { TaskDto } from '../types'
import {
  insertTask,
  listTasksByType,
  listTasksByTypeAndProject,
  listTasksByTypeAndProjectAndUser,
  type TaskRow,
} from '../repositories/taskRepository'
import { projectExists } from '../repositories/projectRepository'
import type { TaskType } from './notifyService'

export type CreateTaskResult = { ok: true } | { ok: false; error: string; status: number }

export async function listCleanupTasks(DB: D1Database): Promise<TaskDto[]> {
  const rows = await listTasksByType('CLEANUP', DB)
  return rows.map(rowToDto)
}

export async function createCleanupTask(DB: D1Database): Promise<void> {
  await insertTask(crypto.randomUUID(), 'CLEANUP', null, null, Date.now(), DB)
}

export async function listThumbnailTasks(DB: D1Database): Promise<TaskDto[]> {
  const rows = await listTasksByType('THUMBNAIL', DB)
  return rows.map(rowToDto)
}

export async function createThumbnailTask(DB: D1Database): Promise<void> {
  await insertTask(crypto.randomUUID(), 'THUMBNAIL', null, null, Date.now(), DB)
}

export async function listTagTasks(projectId: string, DB: D1Database): Promise<TaskDto[]> {
  const rows = await listTasksByTypeAndProject('TAG', projectId, DB)
  return rows.map(rowToDto)
}

export async function createTagTask(projectId: string, DB: D1Database): Promise<CreateTaskResult> {
  return createProjectTask('TAG', projectId, DB)
}

export async function listDownloadTasks(projectId: string, DB: D1Database): Promise<TaskDto[]> {
  const rows = await listTasksByTypeAndProject('DOWNLOAD', projectId, DB)
  return rows.map(rowToDto)
}

export async function createDownloadTask(projectId: string, DB: D1Database): Promise<CreateTaskResult> {
  return createProjectTask('DOWNLOAD', projectId, DB)
}

/** TAG／DOWNLOAD 共用：不分使用者，只跟 project_id 有關 */
async function createProjectTask(type: TaskType, projectId: string, DB: D1Database): Promise<CreateTaskResult> {
  if (!(await projectExists(projectId, DB))) {
    return { ok: false, error: '專案不存在', status: 404 }
  }

  await insertTask(crypto.randomUUID(), type, projectId, null, Date.now(), DB)
  return { ok: true }
}

export async function listExportTasks(projectId: string, userId: string, DB: D1Database): Promise<TaskDto[]> {
  const rows = await listTasksByTypeAndProjectAndUser('EXPORT', projectId, userId, DB)
  return rows.map(rowToDto)
}

export async function createExportTask(projectId: string, userId: string, DB: D1Database): Promise<CreateTaskResult> {
  return createUserProjectTask('EXPORT', projectId, userId, DB)
}

export async function listCaptionTasks(projectId: string, userId: string, DB: D1Database): Promise<TaskDto[]> {
  const rows = await listTasksByTypeAndProjectAndUser('CAPTION', projectId, userId, DB)
  return rows.map(rowToDto)
}

export async function createCaptionTask(projectId: string, userId: string, DB: D1Database): Promise<CreateTaskResult> {
  return createUserProjectTask('CAPTION', projectId, userId, DB)
}

/**
 * EXPORT／CAPTION 共用：只驗證使用者身份、不驗證專案存取權限——project_id 是 body/query 參數
 * 而非路徑參數，依現行認證機制不會觸發第 2 層專案存取驗證。
 */
async function createUserProjectTask(
  type: TaskType,
  projectId: string,
  userId: string,
  DB: D1Database,
): Promise<CreateTaskResult> {
  if (!(await projectExists(projectId, DB))) {
    return { ok: false, error: '專案不存在', status: 404 }
  }

  await insertTask(crypto.randomUUID(), type, projectId, userId, Date.now(), DB)
  return { ok: true }
}

/** project_id／user_id 為 NULL 時整個 key 省略（不是回傳 null 值） */
function rowToDto(row: TaskRow): TaskDto {
  const dto: TaskDto = {
    id: row.id,
    type: row.type,
    status: row.status,
    created_at: new Date(row.created_at).toISOString(),
  }

  if (row.project_id) dto.project_id = row.project_id
  if (row.user_id) dto.user_id = row.user_id

  return dto
}
