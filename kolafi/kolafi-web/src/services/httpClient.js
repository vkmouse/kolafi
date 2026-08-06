/**
 * HTTP 客戶端
 * 統一處理 API 請求，自動添加認證 header
 */

import { getAuthHeaders } from './authService'

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
}

/**
 * 發送 HTTP 請求
 */
async function request(url, options = {}) {
  const headers = {
    ...DEFAULT_HEADERS,
    ...getAuthHeaders(),
    ...options.headers
  }

  const config = {
    ...options,
    headers,
    credentials: 'include'
  }

  try {
    const response = await fetch(url, config)
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    return result
  } catch (error) {
    console.error(`API 請求失敗 [${options.method || 'GET'} ${url}]:`, error)
    throw error
  }
}

/**
 * GET 請求
 */
export async function get(url, options = {}) {
  return request(url, { ...options, method: 'GET' })
}

/**
 * POST 請求
 */
export async function post(url, body, options = {}) {
  return request(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body)
  })
}

/**
 * PUT 請求
 */
export async function put(url, body, options = {}) {
  return request(url, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(body)
  })
}

/**
 * PATCH 請求
 */
export async function patch(url, body, options = {}) {
  return request(url, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(body)
  })
}

/**
 * DELETE 請求
 */
export async function del(url, options = {}) {
  return request(url, { ...options, method: 'DELETE' })
}

export default {
  get,
  post,
  put,
  patch,
  del
}
