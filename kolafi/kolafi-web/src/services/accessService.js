/**
 * Cloudflare Access（Service Token）前端驗證流程。
 *
 * 正式環境下 /api/* 架在 Cloudflare Access 後面，Access edge 會在請求進到
 * kolafi-web 之前就先驗證 CF-Access-Client-Id / CF-Access-Client-Secret 這兩個
 * header，通過才放行，驗不過直接被 edge 擋掉（回 401/403）。
 *
 * 因為驗證本身在 edge 完成，後端程式碼完全不用另外驗這組憑證；這個模組只負責
 * 「讓使用者輸入一次、存起來、之後每個 /api/* 請求自動帶上」。
 *
 * 刻意保持獨立（不依賴 authService.js、不依賴 httpClient.js），方便未來需要
 * 同一套「輸入 Client ID / Secret 換取存取」流程時，可以直接把這個檔案跟
 * AccessGate.vue 一起複製使用。
 */

const CLIENT_ID_KEY = 'cf_access_client_id'
const CLIENT_SECRET_KEY = 'cf_access_client_secret'

/** 用來試探憑證是否正確的端點；只要能通過 Access edge（不管業務邏輯回什麼）就代表憑證有效。 */
const PROBE_URL = '/api/users'

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
 * 帶著指定憑證打一次 PROBE_URL，只用來確認「Cloudflare Access edge 認不認這組
 * Service Token」，不管業務邏輯回應的內容或狀態碼細節：
 * - 有回應（不管 200 或業務邏輯的錯誤碼）→ 代表有通過 Access edge → true
 * - 401 / 403 → Access edge 直接擋下 → false
 * - 網路錯誤 → false
 *
 * 不帶參數時讀 localStorage 裡已存的值（給 AccessGate 掛載時「用舊憑證重新
 * 確認一次」的情境用）；帶參數時直接用傳入的值打這次請求，不會去讀/寫
 * localStorage——留給「使用者剛輸入、還沒驗證過」的情境用。
 */
export async function verifyAccessCredentials(credentials) {
  const creds = credentials ?? getStoredAccessCredentials()
  if (!creds) {
    return false
  }

  let response
  try {
    response = await fetch(PROBE_URL, {
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

  return response.status !== 401 && response.status !== 403
}
