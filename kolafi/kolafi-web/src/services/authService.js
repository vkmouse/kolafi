/**
 * 認證服務
 * 處理用戶認證相關邏輯
 */

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'current_user'

/**
 * 獲取所有使用者清單
 */
export async function fetchUsers() {
  try {
    const response = await fetch('/api/users', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    const result = await response.json()
    
    if (result.success && result.data) {
      return result.data
    } else {
      throw new Error(result.error || '無法獲取使用者清單')
    }
  } catch (error) {
    console.error('獲取使用者清單失敗:', error)
    throw error
  }
}

/**
 * 初始化認證 - 獲取第一個使用者並存儲
 */
export async function initializeAuth() {
  try {
    // 檢查是否已有儲存的 token
    const existingToken = localStorage.getItem(TOKEN_KEY)
    if (existingToken) {
      const existingUser = localStorage.getItem(USER_KEY)
      return {
        token: existingToken,
        user: JSON.parse(existingUser)
      }
    }

    // 獲取使用者清單
    const users = await fetchUsers()
    
    if (!users || users.length === 0) {
      throw new Error('沒有可用的使用者')
    }

    // 使用第一個使用者
    const firstUser = users[0]
    
    // 儲存 token 和使用者資訊
    localStorage.setItem(TOKEN_KEY, firstUser.id)
    localStorage.setItem(USER_KEY, JSON.stringify(firstUser))
    
    return {
      token: firstUser.id,
      user: firstUser
    }
  } catch (error) {
    console.error('初始化認證失敗:', error)
    throw error
  }
}

/**
 * 獲取當前的認證文件（用於 Authorization header）
 */
export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * 獲取當前使用者資訊
 */
export function getCurrentUser() {
  const userJSON = localStorage.getItem(USER_KEY)
  return userJSON ? JSON.parse(userJSON) : null
}

/**
 * 取得授權 header 物件
 */
export function getAuthHeaders() {
  const token = getAuthToken()
  if (!token) {
    return {}
  }
  return {
    'Authorization': `Bearer ${token}`
  }
}

/**
 * 清除認證資訊（登出）
 */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/**
 * 切換使用者
 */
export async function switchUser(userId) {
  try {
    const users = await fetchUsers()
    const selectedUser = users.find(u => u.id === userId)
    
    if (!selectedUser) {
      throw new Error('使用者不存在')
    }

    localStorage.setItem(TOKEN_KEY, selectedUser.id)
    localStorage.setItem(USER_KEY, JSON.stringify(selectedUser))
    
    // 刷新頁面以重新載入數據
    window.location.reload()
    
    return selectedUser
  } catch (error) {
    console.error('切換使用者失敗:', error)
    throw error
  }
}

/**
 * 獲取所有使用者清單，用於切換使用者
 */
export async function getAllUsers() {
  try {
    return await fetchUsers()
  } catch (error) {
    console.error('獲取使用者清單失敗:', error)
    throw error
  }
}
