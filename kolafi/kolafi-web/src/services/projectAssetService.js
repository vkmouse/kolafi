/**
 * 專案素材服務
 * 處理專案素材相關的 API 請求
 */

import { post, put, del } from './httpClient'

/**
 * 匯入素材到專案
 */
export async function ImportAssetsToProject(projectId, assetIds) {
  try {
    const result = await post(`/api/projects/${projectId}/assets`, { asset_ids: assetIds })
    return result
  } catch (error) {
    console.error('匯入素材失敗:', error)
    throw error
  }
}

/**
 * 從專案移除素材
 */
export async function removeAssetFromProject(projectId, assetId) {
  try {
    const result = await del(`/api/projects/${projectId}/assets/${assetId}`)
    return result
  } catch (error) {
    console.error('移除素材失敗:', error)
    throw error
  }
}

/**
 * 更新專案選擇的素材
 */
export async function updateProjectAssets(projectId, assetIds) {
  try {
    const result = await put(`/api/projects/${projectId}/assets/select`, { asset_ids: assetIds })
    return result
  } catch (error) {
    console.error('更新專案素材失敗:', error)
    throw error
  }
}

/**
 * 上傳素材到專案
 * @param {string} projectId - 專案 ID
 * @param {File} file - 要上傳的文件
 * @param {Function} onProgress - 進度回調函數，接收 { loaded, total, percentage }
 */
export async function uploadAssetToProject(projectId, file, onProgress) {
  try {
    const { getAuthHeaders } = await import('./authService')
    const formData = new FormData()
    formData.append('file', file)

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      // 監聽上傳進度
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const loaded = event.loaded
          const total = event.total
          const percentage = Math.round((loaded / total) * 100)
          if (onProgress) {
            onProgress({ loaded, total, percentage })
          }
        }
      })

      // 監聽上傳完成
      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 201) {
          const result = JSON.parse(xhr.responseText)
          resolve(result)
        } else {
          try {
            const result = JSON.parse(xhr.responseText)
            reject(new Error(result.error || `上傳失敗: ${xhr.statusText}`))
          } catch (e) {
            reject(new Error(`上傳失敗: ${xhr.statusText}`))
          }
        }
      })

      // 監聽上傳錯誤
      xhr.addEventListener('error', () => {
        reject(new Error('上傳過程中發生錯誤'))
      })

      // 監聽上傳中斷
      xhr.addEventListener('abort', () => {
        reject(new Error('上傳已取消'))
      })

      xhr.open('POST', `/api/projects/${projectId}/assets/upload`)
      const headers = getAuthHeaders()
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value)
      })
      xhr.withCredentials = true
      xhr.send(formData)
    })
  } catch (error) {
    console.error('上傳素材失敗:', error)
    throw error
  }
}

export default {
  ImportAssetsToProject,
  removeAssetFromProject,
  updateProjectAssets,
  uploadAssetToProject
}
