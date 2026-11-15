/**
 * OAuth 授權服務
 * 處理 /authorize 畫面呼叫 POST /api/authorize 的流程
 *
 * /authorize 畫面由 AccessGate 把關，通過後 Cloudflare Access 憑證已存在 localStorage，
 * 這裡跟其他 service 一樣用 getAccessHeaders 附上。不透過 httpClient：httpClient 失敗時
 * 只丟出錯誤訊息、不帶狀態碼，而這裡要靠 400 判斷是授權請求本身有問題。
 */

import { getAccessHeaders } from './accessService'

const AUTHORIZE_URL = '/api/authorize'

const AUTHORIZE_PARAM_NAMES = [
  'response_type',
  'client_id',
  'redirect_uri',
  'state',
  'code_challenge',
  'code_challenge_method',
  'resource',
]

/**
 * 取出 Query String 裡的授權參數，有帶才會有該欄位，沒帶的由後端判定缺漏
 */
export function readAuthorizeParams(search) {
  const query = new URLSearchParams(search)
  const params = {}
  for (const name of AUTHORIZE_PARAM_NAMES) {
    const value = query.get(name)
    if (value !== null) {
      params[name] = value
    }
  }
  return params
}

async function readErrorCode(response) {
  try {
    const body = await response.json()
    return body?.error ?? ''
  } catch {
    return ''
  }
}

/**
 * 呼叫授權端點，回傳三種結果之一：
 * - { kind: 'redirect', url }：授權成功，url 是帶著 code（以及有帶才有的 state）的回呼網址
 * - { kind: 'rejected', error }：後端驗證失敗（400），error 是標準錯誤碼，不導回第三方網站
 * - { kind: 'failed' }：其他所有情形（連線中斷、非預期的回應，包含被外部存取控管服務攔下的 403）
 */
export async function requestAuthorization(params) {
  let response
  try {
    response = await fetch(AUTHORIZE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAccessHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify(params),
    })
  } catch (error) {
    console.error('授權請求失敗:', error)
    return { kind: 'failed' }
  }

  // 後端自己的驗證失敗一律是 400
  if (response.status === 400) {
    return { kind: 'rejected', error: await readErrorCode(response) }
  }
  if (!response.ok) {
    return { kind: 'failed' }
  }

  try {
    const body = await response.json()
    // redirect_uri 已經由後端比對過與註冊的網址完全一致，這裡只負責把 code 接上去
    const url = new URL(params.redirect_uri ?? '')
    url.searchParams.append('code', body.code)
    if (body.state !== undefined) {
      url.searchParams.append('state', body.state)
    }
    return { kind: 'redirect', url: url.toString() }
  } catch (error) {
    console.error('解析授權回應失敗:', error)
    return { kind: 'failed' }
  }
}
