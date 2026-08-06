/**
 * 任務服務
 * 處理任務相關的 API 請求
 */

import { get, post } from './httpClient'

/**
 * 獲取清理任務列表
 */
export async function getCleanupTasks() {
  try {
    const result = await get('/api/tasks/cleanup')
    return result
  } catch (error) {
    console.error('獲取清理任務失敗:', error)
    throw error
  }
}

/**
 * 創建清理任務
 */
export async function createCleanupTask() {
  try {
    const result = await post('/api/tasks/cleanup', {})
    return result
  } catch (error) {
    console.error('創建清理任務失敗:', error)
    throw error
  }
}

/**
 * 獲取縮圖任務列表
 */
export async function getThumbnailTasks() {
  try {
    const result = await get('/api/tasks/thumbnail')
    return result
  } catch (error) {
    console.error('獲取縮圖任務失敗:', error)
    throw error
  }
}

/**
 * 創建縮圖任務
 */
export async function createThumbnailTasks() {
  try {
    const result = await post('/api/tasks/thumbnail', {})
    return result
  } catch (error) {
    console.error('創建縮圖任務失敗:', error)
    throw error
  }
}

/**
 * 創建匯出任務
 */
export async function createExportTask(projectId, options) {
  try {
    const result = await post('/api/tasks/export', {
      project_id: projectId,
      ...options
    })
    return result
  } catch (error) {
    console.error('創建匯出任務失敗:', error)
    throw error
  }
}

/**
 * 創建文案生成任務
 */
export async function createCaptionTask(projectId) {
  try {
    const result = await post('/api/tasks/caption', { project_id: projectId })
    return result
  } catch (error) {
    console.error('創建文案生成任務失敗:', error)
    throw error
  }
}

/**
 * 創建標籤生成任務
 */
export async function createTagTask(projectId) {
  try {
    const result = await post('/api/tasks/tag', { project_id: projectId })
    return result
  } catch (error) {
    console.error('創建標籤生成任務失敗:', error)
    throw error
  }
}

/**
 * 創建素材下載任務
 */
export async function createDownloadTask(projectId, tags) {
  try {
    const result = await post('/api/tasks/download', {
      project_id: projectId,
      tags
    })
    return result
  } catch (error) {
    console.error('創建下載任務失敗:', error)
    throw error
  }
}

/**
 * 獲取文案任務列表
 */
export async function getCaptionTasks(projectId) {
  try {
    const result = await get(`/api/tasks/caption?project_id=${projectId}`)
    return result
  } catch (error) {
    console.error('獲取文案任務失敗:', error)
    throw error
  }
}

/**
 * 獲取標籤任務列表
 */
export async function getTagTasks(projectId) {
  try {
    const result = await get(`/api/tasks/tag?project_id=${projectId}`)
    return result
  } catch (error) {
    console.error('獲取標籤任務失敗:', error)
    throw error
  }
}

/**
 * 獲取下載任務列表
 */
export async function getDownloadTasks(projectId) {
  try {
    const result = await get(`/api/tasks/download?project_id=${projectId}`)
    return result
  } catch (error) {
    console.error('獲取下載任務失敗:', error)
    throw error
  }
}

/**
 * 獲取匯出任務列表
 */
export async function getExportTasks(projectId) {
  try {
    const result = await get(`/api/tasks/export?project_id=${projectId}`)
    return result
  } catch (error) {
    console.error('獲取匯出任務失敗:', error)
    throw error
  }
}

export default {
  getCleanupTasks,
  createCleanupTask,
  getThumbnailTasks,
  createThumbnailTasks,
  createExportTask,
  createCaptionTask,
  createTagTask,
  createDownloadTask,
  getCaptionTasks,
  getTagTasks,
  getDownloadTasks,
  getExportTasks
}
