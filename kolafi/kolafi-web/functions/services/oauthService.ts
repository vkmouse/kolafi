/**
 * OAuth Server 的業務邏輯：動態註冊、授權（發 `code`）、換 token（`authorization_code` 與
 * `refresh_token` 兩種 grant）。
 *
 * OAuth 端點的失敗回應只帶標準錯誤碼，所以失敗結果的 `error` 放的是錯誤碼本身
 * （例如 `invalid_grant`），不是中文說明；`status` 一律是 400，由 handler 原樣回傳。
 * 資料庫裡的時間一律是 epoch ms（跟全站一致），只有對外的 `expires_in` 是秒。
 */
import type {
  AuthorizeOAuthBody,
  OAuthAuthorizationDto,
  OAuthClientDto,
  OAuthTokenDto,
  RegisterOAuthClientBody,
} from '../types'
import { getOAuthClientById, insertOAuthClient, type OAuthClientRow } from '../repositories/oauthClientRepository'
import { consumeOAuthCode, insertOAuthCode } from '../repositories/oauthCodeRepository'
import {
  deleteExpiredOAuthRefreshTokens,
  deleteOAuthRefreshTokenFamily,
  getOAuthRefreshTokenFamilyId,
  insertOAuthRefreshToken,
  markOAuthRefreshTokenUsed,
  rotateOAuthRefreshToken,
} from '../repositories/oauthRefreshTokenRepository'
import { generateRandomHex256, sha256Hex } from '../utils/hex'
import { OAUTH_ACCESS_TOKEN_TTL_SECONDS, signOAuthAccessToken } from '../utils/oauthJwt'
import { computeS256CodeChallenge } from '../utils/pkce'
import { isHttpsUriList, isNonEmptyString } from '../utils/validators'

/** 授權碼有效時間：10 分鐘 */
const AUTHORIZATION_CODE_TTL_MS = 10 * 60 * 1000

/** refresh token 閒置期限：30 天。每次輪替發出的新 token 重新計算 */
const REFRESH_TOKEN_IDLE_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** refresh token 絕對上限：180 天。同一條鏈固定，輪替不改變 */
const REFRESH_TOKEN_ABSOLUTE_TTL_MS = 180 * 24 * 60 * 60 * 1000

export type OAuthFailure = { ok: false; error: string; status: number }

function badRequest(error: string): OAuthFailure {
  return { ok: false, error, status: 400 }
}

function parseRedirectUris(row: OAuthClientRow): string[] {
  return JSON.parse(row.redirect_uris) as string[]
}

export type RegisterOAuthClientResult = { ok: true; data: OAuthClientDto } | OAuthFailure

export async function registerClient(body: RegisterOAuthClientBody, DB: D1Database): Promise<RegisterOAuthClientResult> {
  if (!isHttpsUriList(body.redirect_uris)) {
    return badRequest('invalid_redirect_uri')
  }

  const clientId = crypto.randomUUID()
  await insertOAuthClient(clientId, JSON.stringify(body.redirect_uris), Date.now(), DB)
  return { ok: true, data: { client_id: clientId, redirect_uris: body.redirect_uris } }
}

export type AuthorizeOAuthResult = { ok: true; data: OAuthAuthorizationDto } | OAuthFailure

export async function authorize(
  body: AuthorizeOAuthBody,
  resourceUrl: string,
  DB: D1Database,
): Promise<AuthorizeOAuthResult> {
  // 五個必要參數都要有帶；state 選填，不在此列
  const responseType = body.response_type
  const clientId = body.client_id
  const redirectUri = body.redirect_uri
  const codeChallenge = body.code_challenge
  const codeChallengeMethod = body.code_challenge_method
  if (
    !isNonEmptyString(responseType) ||
    !isNonEmptyString(clientId) ||
    !isNonEmptyString(redirectUri) ||
    !isNonEmptyString(codeChallenge) ||
    !isNonEmptyString(codeChallengeMethod)
  ) {
    return badRequest('invalid_request')
  }
  const state = typeof body.state === 'string' ? body.state : undefined

  if (responseType !== 'code') {
    return badRequest('unsupported_response_type')
  }

  const client = await getOAuthClientById(clientId, DB)
  if (!client) {
    return badRequest('invalid_client')
  }
  if (!parseRedirectUris(client).includes(redirectUri)) {
    return badRequest('invalid_request')
  }

  if (codeChallengeMethod !== 'S256') {
    return badRequest('invalid_request')
  }

  // resource（RFC 8707）選填：有帶就必須是本站的 MCP 伺服器。不另外儲存，
  // access token 的 aud 一律是 MCP 伺服器的網址
  if (body.resource !== undefined && body.resource !== resourceUrl) {
    return badRequest('invalid_target')
  }

  const code = generateRandomHex256()
  await insertOAuthCode(
    {
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      expires_at: Date.now() + AUTHORIZATION_CODE_TTL_MS,
    },
    DB,
  )
  return { ok: true, data: state === undefined ? { code } : { code, state } }
}

export type ExchangeOAuthTokenResult = { ok: true; data: OAuthTokenDto } | OAuthFailure

/**
 * `grant_type` 分派：先讀 `grant_type`，再交給各自的流程。不收 client_secret，
 * 各流程不需要的多餘參數一律忽略。
 */
export async function exchangeToken(
  form: FormData,
  secret: string,
  resourceUrl: string,
  DB: D1Database,
): Promise<ExchangeOAuthTokenResult> {
  const grantType = form.get('grant_type')
  if (!isNonEmptyString(grantType)) {
    return badRequest('invalid_request')
  }

  if (grantType === 'authorization_code') {
    return await exchangeAuthorizationCode(form, secret, resourceUrl, DB)
  }
  if (grantType === 'refresh_token') {
    return await exchangeRefreshToken(form, secret, resourceUrl, DB)
  }
  return badRequest('unsupported_grant_type')
}

/**
 * 簽發 refresh token 的第一個（一條新鏈的起點）：明文只回給 Client，DB 只存雜湊。
 * 寫入失敗視為未預期的例外；此時 code 已作廢，Client 須重新授權。
 */
async function issueInitialRefreshToken(clientId: string, DB: D1Database): Promise<string> {
  const refreshToken = generateRandomHex256()
  const now = Date.now()
  await insertOAuthRefreshToken(
    {
      token_hash: await sha256Hex(refreshToken),
      family_id: crypto.randomUUID(),
      client_id: clientId,
      idle_expires_at: now + REFRESH_TOKEN_IDLE_TTL_MS,
      absolute_expires_at: now + REFRESH_TOKEN_ABSOLUTE_TTL_MS,
    },
    DB,
  )
  return refreshToken
}

async function exchangeAuthorizationCode(
  form: FormData,
  secret: string,
  resourceUrl: string,
  DB: D1Database,
): Promise<ExchangeOAuthTokenResult> {
  // 四個參數都要有帶（grant_type 已在分派時檢查）。resource 以外多送的參數一律忽略
  const code = form.get('code')
  const redirectUri = form.get('redirect_uri')
  const clientId = form.get('client_id')
  const codeVerifier = form.get('code_verifier')
  if (
    !isNonEmptyString(code) ||
    !isNonEmptyString(redirectUri) ||
    !isNonEmptyString(clientId) ||
    !isNonEmptyString(codeVerifier)
  ) {
    return badRequest('invalid_request')
  }

  // resource（RFC 8707）選填：有帶就必須是本站的 MCP 伺服器。這是參數層級的檢查，
  // 在取出 code 之前，失敗時 code 不受影響
  const resource = form.get('resource')
  if (resource !== null && resource !== resourceUrl) {
    return badRequest('invalid_target')
  }

  // code 一取出就刪除，不論後面的驗證成功或失敗：之後任何一項驗證不通過，
  // 這個 code 都已作廢，Client 必須重新授權
  const codeRow = await consumeOAuthCode(code, DB)
  if (!codeRow) {
    return badRequest('invalid_grant')
  }
  if (codeRow.expires_at <= Date.now()) {
    return badRequest('invalid_grant')
  }
  if (codeRow.client_id !== clientId || codeRow.redirect_uri !== redirectUri) {
    return badRequest('invalid_grant')
  }
  if ((await computeS256CodeChallenge(codeVerifier)) !== codeRow.code_challenge) {
    return badRequest('invalid_grant')
  }

  // 先寫入 refresh token，再簽發 access token
  const refreshToken = await issueInitialRefreshToken(clientId, DB)
  return {
    ok: true,
    data: {
      access_token: await signOAuthAccessToken(secret, clientId, resourceUrl),
      token_type: 'Bearer',
      expires_in: OAUTH_ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
    },
  }
}

/**
 * 用 refresh token 換新的 access token 與 refresh token，每次都輪替。所有 refresh
 * 失敗一律回 `invalid_grant`，不細分原因，避免洩漏 token 的狀態。
 */
async function exchangeRefreshToken(
  form: FormData,
  secret: string,
  resourceUrl: string,
  DB: D1Database,
): Promise<ExchangeOAuthTokenResult> {
  // A. 參數檢查
  const refreshToken = form.get('refresh_token')
  const clientId = form.get('client_id')
  if (!isNonEmptyString(refreshToken) || !isNonEmptyString(clientId)) {
    return badRequest('invalid_request')
  }
  const resource = form.get('resource')
  if (resource !== null && resource !== resourceUrl) {
    return badRequest('invalid_target')
  }

  // B. 取用 token
  const tokenHash = await sha256Hex(refreshToken)
  const now = Date.now()
  const used = await markOAuthRefreshTokenUsed(tokenHash, now, DB)
  if (!used) {
    // 沒有回傳：token 不存在，或已被使用。查到代表是重用，作廢整條鏈；
    // 查不到則沒有可作廢的鏈（從未存在，或所屬的鏈已被作廢或清理）
    const familyId = await getOAuthRefreshTokenFamilyId(tokenHash, DB)
    if (familyId !== null) {
      await deleteOAuthRefreshTokenFamily(familyId, DB)
    }
    return badRequest('invalid_grant')
  }

  // C. 驗證：任何一項不通過，這條鏈都作廢。
  // 正常流程下 idle_expires_at 不會超過 absolute_expires_at，絕對上限的檢查理論上不會單獨
  // 觸發，仍保留當防禦性檢查
  if (used.client_id !== clientId || used.idle_expires_at <= now || used.absolute_expires_at <= now) {
    await deleteOAuthRefreshTokenFamily(used.family_id, DB)
    return badRequest('invalid_grant')
  }

  // D. 輪替：新 token 的閒置到期不超過絕對上限
  const newRefreshToken = generateRandomHex256()
  const rotated = await rotateOAuthRefreshToken(
    tokenHash,
    await sha256Hex(newRefreshToken),
    Math.min(now + REFRESH_TOKEN_IDLE_TTL_MS, used.absolute_expires_at),
    DB,
  )
  if (!rotated) {
    // 舊列已被並行請求作廢而消失，鏈已不存在
    return badRequest('invalid_grant')
  }

  // E. 簽發與收尾
  const accessToken = await signOAuthAccessToken(secret, clientId, resourceUrl)

  // 清理失敗只記 log，不影響已成功的 refresh
  try {
    await deleteExpiredOAuthRefreshTokens(now, DB)
  } catch (err) {
    console.error('[token] 清理過期 refresh token 失敗', err)
  }

  return {
    ok: true,
    data: {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: OAUTH_ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: newRefreshToken,
    },
  }
}
