/**
 * 專案服務
 * 處理專案相關的 API 請求
 */

import { get, post, put, del } from './httpClient'

/**
 * 獲取所有專案列表
 * @param {string} status - 狀態篩選 (ALL, DRAFT, PENDING, PUBLISHED)
 * @param {number} page - 頁碼，從 1 開始
 * @param {number} pageSize - 每頁數量
 * @param {string} search - 名稱模糊查詢關鍵字
 * @param {string} sort - 排序方向 (asc 或 desc)
 */
export async function getProjects(status = 'ALL', page = 1, pageSize = 20, search = '', sort = 'desc') {
  try {
    const params = new URLSearchParams()
    
    if (status && status !== 'ALL') {
      params.append('status', status)
    }
    params.append('page', page)
    params.append('page_size', pageSize)
    if (search) {
      params.append('search', search)
    }
    if (sort && sort !== 'desc') {
      params.append('sort', sort)
    }
    
    const url = '/api/projects?' + params.toString()
    const result = await get(url)
    return result
  } catch (error) {
    console.error('獲取專案列表失敗:', error)
    throw error
  }
}

/**
 * 獲取單個專案詳情
 */
export async function getProject(projectId) {
  try {
    const result = await get(`/api/projects/${projectId}`)
    return result
  } catch (error) {
    console.error('獲取專案詳情失敗:', error)
    throw error
  }
}

/**
 * 創建新專案
 */
export async function createProject(projectName) {
  try {
    const result = await post('/api/projects', { name: projectName })
    return result
  } catch (error) {
    console.error('創建專案失敗:', error)
    throw error
  }
}

/**
 * 更新專案狀態
 */
export async function updateProjectStatus(projectId, status) {
  try {
    const result = await put(`/api/projects/${projectId}/status`, { status })
    return result
  } catch (error) {
    console.error('更新專案狀態失敗:', error)
    throw error
  }
}

/**
 * 更新專案名稱
 */
export async function updateProjectName(projectId, name) {
  try {
    const result = await put(`/api/projects/${projectId}/name`, { name })
    return result
  } catch (error) {
    console.error('更新專案名稱失敗:', error)
    throw error
  }
}

/**
 * 更新專案文案
 */
export async function updateProjectCaption(projectId, caption) {
  try {
    const result = await put(`/api/projects/${projectId}/caption`, { caption })
    return result
  } catch (error) {
    console.error('更新專案文案失敗:', error)
    throw error
  }
}


/**
 * 更新專案匯出選項
 */
export async function updateExportOptions(projectId, options) {
  try {
    const result = await put(`/api/projects/${projectId}/export`, options)
    return result
  } catch (error) {
    console.error('更新匯出選項失敗:', error)
    throw error
  }
}

/**
 * 刪除專案
 */
export async function deleteProject(projectId) {
  try {
    const result = await del(`/api/projects/${projectId}`)
    return result
  } catch (error) {
    console.error('刪除專案失敗:', error)
    throw error
  }
}

/**
 * 獲取專案統計數據
 */
export async function getProjectsStats() {
  try {
    const result = await get('/api/projects/stats')
    return result
  } catch (error) {
    console.error('獲取專案統計失敗:', error)
    throw error
  }
}

export default {
  getProjects,
  getProject,
  createProject,
  updateProjectStatus,
  updateProjectName,
  updateProjectCaption,
  updateExportOptions,
  getProjectsStats
}
