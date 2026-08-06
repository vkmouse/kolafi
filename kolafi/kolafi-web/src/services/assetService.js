/**
 * 素材服務
 * 處理素材相關的 API 請求
 */

import { get, post, del } from './httpClient'
import { getAuthHeaders } from './authService'

/**
 * 獲取所有素材列表
 * @param {string} filter - 篩選類型 (all, unused, image, video)
 * @param {number} page - 頁碼，從 1 開始
 * @param {number} pageSize - 每頁數量
 */
export async function getAssets(filter = 'all', page = 1, pageSize = 50) {
  try {
    let url = '/api/assets?'
    const params = new URLSearchParams()
    
    if (filter && filter !== 'all') {
      params.append('filter', filter)
    }
    params.append('page', page)
    params.append('page_size', pageSize)
    
    url += params.toString()
    const result = await get(url)
    return result
  } catch (error) {
    console.error('獲取素材列表失敗:', error)
    throw error
  }
}

/**
 * 上傳素材
 * @param {File} file - 要上傳的文件
 * @param {Function} onProgress - 進度回調函數，接收 { loaded, total, percentage }
 */
export async function uploadAsset(file, onProgress) {
  try {
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
          const result = JSON.parse(xhr.responseText)
          reject(new Error(result.error || `上傳失敗: ${xhr.statusText}`))
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

      xhr.open('POST', '/api/assets/upload')
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

/**
 * 刪除素材
 */
export async function deleteAsset(assetId) {
  try {
    const result = await del(`/api/assets/${assetId}`)
    return result
  } catch (error) {
    console.error('刪除素材失敗:', error)
    throw error
  }
}

/**
 * 獲取未使用的素材列表（用於匯入）
 */
export async function getUnusedAssets() {
  try {
    const result = await get('/api/assets?filter=unused')
    return result
  } catch (error) {
    console.error('獲取未使用素材失敗:', error)
    throw error
  }
}

/**
 * 獲取素材統計數據
 */
export async function getAssetsStats() {
  try {
    const result = await get('/api/assets/stats')
    return result
  } catch (error) {
    console.error('獲取素材統計失敗:', error)
    throw error
  }
}

export default {
  getAssets,
  uploadAsset,
  deleteAsset,
  getUnusedAssets,
  getAssetsStats
}
