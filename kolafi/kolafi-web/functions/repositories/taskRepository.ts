/** tasks 表的通用存取層，供前端 Tasks API 與 internal Pull/Ack API 共用 */

export interface TaskRow {
  id: string
  type: string
  project_id: string | null
  user_id: string | null
  status: string
  created_at: number
}

/** 每種 Worker 只有 1 個實例在跑，不會有搶任務的併發問題，故不需要鎖定機制 */
export async function findOldestPendingTask(type: string, DB: D1Database): Promise<TaskRow | null> {
  const sql = `SELECT id, type, project_id, user_id, status, created_at
    FROM tasks
    WHERE type = ? AND status = 'PENDING'
    ORDER BY created_at ASC
    LIMIT 1`
  return await DB.prepare(sql).bind(type).first<TaskRow>()
}

/** 把任務標記為 PROCESSING（Pull 拿到任務後的第一步） */
export async function markTaskProcessing(taskId: string, DB: D1Database): Promise<void> {
  await DB.prepare(`UPDATE tasks SET status = 'PROCESSING' WHERE id = ?`).bind(taskId).run()
}

/** 把任務標記為最終狀態（SUCCESS 或 FAILED），對應 Ack 收到後的最後一步 */
export async function markTaskStatus(taskId: string, status: 'SUCCESS' | 'FAILED', DB: D1Database): Promise<void> {
  await DB.prepare(`UPDATE tasks SET status = ? WHERE id = ?`).bind(status, taskId).run()
}

export async function getTaskById(taskId: string, DB: D1Database): Promise<TaskRow | null> {
  const sql = `SELECT id, type, project_id, user_id, status, created_at FROM tasks WHERE id = ?`
  return await DB.prepare(sql).bind(taskId).first<TaskRow>()
}

/** 取得指定類型的任務清單，不分專案，依 created_at 新到舊排序 */
export async function listTasksByType(type: string, DB: D1Database): Promise<TaskRow[]> {
  const sql = `SELECT id, type, project_id, user_id, status, created_at
    FROM tasks
    WHERE type = ?
    ORDER BY created_at DESC`
  const { results } = await DB.prepare(sql).bind(type).all<TaskRow>()
  return results ?? []
}

/** 取得指定類型、指定專案的任務清單，依 created_at 新到舊排序 */
export async function listTasksByTypeAndProject(type: string, projectId: string, DB: D1Database): Promise<TaskRow[]> {
  const sql = `SELECT id, type, project_id, user_id, status, created_at
    FROM tasks
    WHERE type = ? AND project_id = ?
    ORDER BY created_at DESC`
  const { results } = await DB.prepare(sql).bind(type, projectId).all<TaskRow>()
  return results ?? []
}

/** 取得指定類型、指定專案、指定使用者的任務清單，依 created_at 新到舊排序（EXPORT／CAPTION 專用） */
export async function listTasksByTypeAndProjectAndUser(
  type: string,
  projectId: string,
  userId: string,
  DB: D1Database,
): Promise<TaskRow[]> {
  const sql = `SELECT id, type, project_id, user_id, status, created_at
    FROM tasks
    WHERE type = ? AND project_id = ? AND user_id = ?
    ORDER BY created_at DESC`
  const { results } = await DB.prepare(sql).bind(type, projectId, userId).all<TaskRow>()
  return results ?? []
}

/**
 * 新增一筆 PENDING 任務。`projectId`／`userId` 傳 null 代表該欄位維持 NULL
 * （全域任務不帶 projectId；不分使用者的任務不帶 userId）。
 */
export async function insertTask(
  id: string,
  type: string,
  projectId: string | null,
  userId: string | null,
  createdAt: number,
  DB: D1Database,
): Promise<void> {
  const sql = `INSERT INTO tasks (id, type, project_id, user_id, status, created_at) VALUES (?, ?, ?, ?, 'PENDING', ?)`
  await DB.prepare(sql).bind(id, type, projectId, userId, createdAt).run()
}
