/**
 * Cloudflare Access 憑證 + App JWT session 維護。
 *
 * /api/auth/login 打得通同時代表 Service Token 有效、也換到了
 * access_token / refresh_token Cookie，所以拿它當驗證探測端點，不用再另外
 * probe 業務端點。
 *
 * isAuthenticated 是全域共享狀態，AccessGate.vue 跟 httpClient.js
 * （401 復原失敗時）共用同一份，不用額外套件。
 */
import { ref } from 'vue'

const CLIENT_ID_KEY = 'cf_access_client_id'
const CLIENT_SECRET_KEY = 'cf_access_client_secret'

const LOGIN_URL = '/api/auth/login'
const REFRESH_URL = '/api/auth/refresh'

/** 全域共享的驗證狀態，AccessGate.vue 跟 httpClient.js 共用同一份。 */
export const isAuthenticated = ref(false)

/**
 * 從 localStorage 讀取憑證，兩個值都存在才視為有效，任一缺漏視為未設定。
 */
export function getStoredAccessCredentials() {
  const clientId = localStorage.getItem(CLIENT_ID_KEY)
  const clientSecret = localStorage.getItem(CLIENT_SECRET_KEY)
  if (!clientId || !clientSecret) {
    return null
  }
  return { clientId, clientSecret }
}

export function storeAccessCredentials({ clientId, clientSecret }) {
  localStorage.setItem(CLIENT_ID_KEY, clientId)
  localStorage.setItem(CLIENT_SECRET_KEY, clientSecret)
}

export function clearAccessCredentials() {
  localStorage.removeItem(CLIENT_ID_KEY)
  localStorage.removeItem(CLIENT_SECRET_KEY)
}

/**
 * 供 httpClient.js／authService.js 組 header 用；沒有存值時回傳空物件，
 * 讓請求照樣送出（正式環境會被 Access edge 擋在 401/403，開發環境沒設 policy 則不受影響）。
 */
export function getAccessHeaders() {
  const credentials = getStoredAccessCredentials()
  if (!credentials) {
    return {}
  }
  return {
    'CF-Access-Client-Id': credentials.clientId,
    'CF-Access-Client-Secret': credentials.clientSecret,
  }
}

/**
 * 不帶參數時用 localStorage 裡已存的憑證；帶參數時只拿去試打，不寫入
 * localStorage，避免還沒驗證過的輸入被提早存下來。
 */
export async function verifyAccessCredentials(credentials) {
  const creds = credentials ?? getStoredAccessCredentials()
  if (!creds) {
    return false
  }

  let response
  try {
    response = await fetch(LOGIN_URL, {
      method: 'GET',
      headers: {
        'CF-Access-Client-Id': creds.clientId,
        'CF-Access-Client-Secret': creds.clientSecret,
      },
      credentials: 'include',
    })
  } catch {
    return false
  }

  return response.ok
}

/** 給 recoverSession() 當第一層無感復原用。 */
export async function refreshAccessToken() {
  try {
    const response = await fetch(REFRESH_URL, {
      method: 'POST',
      credentials: 'include',
    })
    return response.ok
  } catch {
    return false
  }
}

let recoveringPromise = null

/**
 * 401 時的復原流程：refresh_token 失敗才重新 /api/auth/login，兩層都失敗
 * 才是真的登出，避免單純 access_token 過期就要使用者重新輸入憑證。
 * recoveringPromise 避免同時間多個請求一起 401 時重複觸發。
 */
export function recoverSession() {
  if (!recoveringPromise) {
    recoveringPromise = (async () => {
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        isAuthenticated.value = true
        return true
      }

      const relogged = await verifyAccessCredentials()
      if (relogged) {
        isAuthenticated.value = true
        return true
      }

      isAuthenticated.value = false
      return false
    })().finally(() => {
      recoveringPromise = null
    })
  }
  return recoveringPromise
}
