/**
 * 標籤服務
 * 處理全域標籤相關的 API 請求
 */

import { get, post, put, del } from './httpClient'

/**
 * 獲取全域標籤列表
 */
export async function getTags() {
  try {
    const result = await get('/api/tags')
    return result
  } catch (error) {
    console.error('獲取標籤列表失敗:', error)
    throw error
  }
}

/**
 * 新增全域標籤
 */
export async function createTag(name) {
  try {
    const result = await post('/api/tags', { name })
    return result
  } catch (error) {
    console.error('新增標籤失敗:', error)
    throw error
  }
}

/**
 * 更新標籤選擇狀態
 */
export async function updateTagSelection(tagId, isSelected) {
  try {
    const result = await put(`/api/tags/${tagId}/select`, { is_selected: isSelected })
    return result
  } catch (error) {
    console.error('更新標籤選擇狀態失敗:', error)
    throw error
  }
}

/**
 * 重新排序標籤
 */
export async function reorderTags(tagIds) {
  try {
    const result = await put('/api/tags/reorder', { tag_ids: tagIds })
    return result
  } catch (error) {
    console.error('重新排序標籤失敗:', error)
    throw error
  }
}

/**
 * 刪除標籤
 */
export async function deleteTag(tagId) {
  try {
    const result = await del(`/api/tags/${tagId}`)
    return result
  } catch (error) {
    console.error('刪除標籤失敗:', error)
    throw error
  }
}

export default {
  getTags,
  createTag,
  updateTagSelection,
  reorderTags,
  deleteTag
}
