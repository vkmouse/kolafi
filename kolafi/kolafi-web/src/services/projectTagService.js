/**
 * 專案標籤服務
 * 處理專案標籤相關的 API 請求
 */

import { get, post, put } from './httpClient'

/**
 * 獲取專案標籤
 */
export async function getProjectTags(projectId) {
  try {
    const result = await get(`/api/projects/${projectId}/tags`)
    return result
  } catch (error) {
    console.error('獲取專案標籤失敗:', error)
    throw error
  }
}

/**
 * 新增專案標籤
 */
export async function AddProjectTag(projectId, tagName) {
  try {
    const result = await post(`/api/projects/${projectId}/tags`, { name: tagName })
    return result
  } catch (error) {
    console.error('創建專案標籤失敗:', error)
    throw error
  }
}

/**
 * 更新專案標籤選擇狀態
 */
export async function updateProjectTagSelection(projectId, tagId, isSelected) {
  try {
    const result = await put(`/api/projects/${projectId}/tags/${tagId}/select`, { is_selected: isSelected })
    return result
  } catch (error) {
    console.error('更新標籤選擇狀態失敗:', error)
    throw error
  }
}

/**
 * 重新排序專案標籤
 */
export async function reorderProjectTags(projectId, tagIds) {
  try {
    const result = await put(`/api/projects/${projectId}/tags/reorder`, { tag_ids: tagIds })
    return result
  } catch (error) {
    console.error('重新排序標籤失敗:', error)
    throw error
  }
}

export default {
  getProjectTags,
  AddProjectTag,
  updateProjectTagSelection,
  reorderProjectTags
}
