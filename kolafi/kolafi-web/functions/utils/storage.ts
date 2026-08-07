import { AwsClient } from 'aws4fetch'
import type { Env } from '../types'

/**
 * 物件儲存存取層，S3 相容 API（實際部署可能是 MinIO），連線參數一律讀環境變數：
 *
 *   assets/{source_id}/{asset_id}{extension}   原始素材檔
 *   thumbs/{source_id}/{asset_id}.jpg          縮圖
 *   exports/{project_id}/...                   匯出檔
 *
 * source_id 對 USER 類型素材固定為 "USER"，對 PROJECT 類型素材為 project_id。
 *
 * Cloudflare Workers 沒有 Node 的網路堆疊可用 aws-sdk，改用 aws4fetch 對 fetch() 做 SigV4 簽章。
 */

export interface S3Config {
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  forcePathStyle: boolean
  cfAccessClientId: string
  cfAccessClientSecret: string
}

/** 讀取 S3 連線設定，各欄位皆有預設值 */
export function getS3Config(env: Env): S3Config {
  return {
    endpoint: env.S3_ENDPOINT || 'http://localhost:9000',
    region: env.S3_REGION || 'us-east-1',
    accessKeyId: env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: env.S3_SECRET_ACCESS_KEY || '',
    bucket: env.S3_BUCKET || 'kolafi',
    forcePathStyle: (env.S3_FORCE_PATH_STYLE || 'true') === 'true',
    cfAccessClientId: env.S3_CF_ACCESS_CLIENT_ID || '',
    cfAccessClientSecret: env.S3_CF_ACCESS_CLIENT_SECRET || '',
  }
}

/** 不論有沒有值都直接帶，本地環境不會驗證這個 header */
function cfAccessHeaders(config: S3Config): Record<string, string> {
  return {
    'CF-Access-Client-Id': config.cfAccessClientId,
    'CF-Access-Client-Secret': config.cfAccessClientSecret,
  }
}

function createS3Client(config: S3Config): AwsClient {
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region,
    service: 's3',
  })
}

/** 組出 bucket 根目錄的 URL，依 forcePathStyle 決定 path-style 或 virtual-hosted-style */
function bucketBaseUrl(config: S3Config): string {
  const endpoint = config.endpoint.replace(/\/+$/, '')

  if (config.forcePathStyle) {
    return `${endpoint}/${config.bucket}`
  }

  const url = new URL(endpoint)
  return `${url.protocol}//${config.bucket}.${url.host}`
}

/** 組出素材原始檔的物件 key */
export function assetKey(sourceId: string, assetId: string, extension: string): string {
  return `assets/${sourceId}/${assetId}${extension}`
}

/** 組出素材縮圖的物件 key（統一為 .jpg） */
export function thumbnailKey(sourceId: string, assetId: string): string {
  return `thumbs/${sourceId}/${assetId}.jpg`
}

/** 組出某個 source（此處固定用 project_id）底下所有原始檔的 prefix */
export function assetsPrefixForSource(sourceId: string): string {
  return `assets/${sourceId}/`
}

/** 組出某個 source（此處固定用 project_id）底下所有縮圖的 prefix */
export function thumbsPrefixForSource(sourceId: string): string {
  return `thumbs/${sourceId}/`
}

/** 組出某個專案底下所有匯出檔的 prefix */
export function exportsPrefixForProject(projectId: string): string {
  return `exports/${projectId}/`
}

/** 檔名規則需與 export-worker 上傳時一致：export_{export_id}.mp4 */
export function exportKey(projectId: string, exportId: string): string {
  return `exports/${projectId}/export_${exportId}.mp4`
}

/**
 * body 直接傳入 File/Blob，Workers 的 fetch 會依 Blob 自動帶 Content-Length，
 * 不需要像 Node 環境那樣先讀成 Buffer 再手動組 header。
 */
export async function putObject(env: Env, key: string, body: Blob | ArrayBuffer, contentType: string): Promise<void> {
  const config = getS3Config(env)
  const client = createS3Client(config)
  const base = bucketBaseUrl(config)
  const url = `${base}/${key.split('/').map(encodeURIComponent).join('/')}`

  const res = await client.fetch(url, {
    method: 'PUT',
    body,
    headers: { ...cfAccessHeaders(config), ...(contentType ? { 'Content-Type': contentType } : {}) },
  })

  if (!res.ok) {
    throw new Error(`上傳物件失敗 key=${key}: HTTP ${res.status}`)
  }
}

export interface StoredObject {
  /** 二進位內容的串流，直接接到 Response body 使用，不在記憶體中整份緩衝 */
  body: ReadableStream<Uint8Array>
}

/**
 * 找不到物件（HTTP 404）回傳 null，由呼叫端決定錯誤訊息（檔案或縮圖不存在）；
 * 其餘非 2xx 狀態視為例外拋出。
 */
export async function getObject(env: Env, key: string): Promise<StoredObject | null> {
  const config = getS3Config(env)
  const client = createS3Client(config)
  const base = bucketBaseUrl(config)
  const url = `${base}/${key.split('/').map(encodeURIComponent).join('/')}`

  const res = await client.fetch(url, { method: 'GET', headers: cfAccessHeaders(config) })

  if (res.status === 404) return null
  if (!res.ok || !res.body) {
    throw new Error(`讀取物件失敗 key=${key}: HTTP ${res.status}`)
  }

  return { body: res.body }
}

/** 對不存在的 key 仍視為成功（冪等） */
export async function deleteObject(env: Env, key: string): Promise<void> {
  const config = getS3Config(env)
  const client = createS3Client(config)
  const base = bucketBaseUrl(config)
  const url = `${base}/${key.split('/').map(encodeURIComponent).join('/')}`

  const res = await client.fetch(url, { method: 'DELETE', headers: cfAccessHeaders(config) })
  if (!res.ok && res.status !== 404) {
    throw new Error(`刪除物件失敗 key=${key}: HTTP ${res.status}`)
  }
}

function extractTagValues(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'g')
  const values: string[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(xml)) !== null) {
    values.push(decodeXmlEntities(match[1]))
  }
  return values
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** 逐批列出 prefix 底下所有 key（處理 ListObjectsV2 的 IsTruncated/ContinuationToken 分頁） */
async function listAllKeys(client: AwsClient, config: S3Config, prefix: string): Promise<string[]> {
  const base = bucketBaseUrl(config)
  const keys: string[] = []
  let continuationToken: string | undefined

  do {
    const listUrl = new URL(`${base}/`)
    listUrl.searchParams.set('list-type', '2')
    listUrl.searchParams.set('prefix', prefix)
    listUrl.searchParams.set('max-keys', '1000')
    if (continuationToken) {
      listUrl.searchParams.set('continuation-token', continuationToken)
    }

    const res = await client.fetch(listUrl.toString(), { method: 'GET', headers: cfAccessHeaders(config) })
    if (!res.ok) {
      throw new Error(`列出物件失敗 prefix=${prefix}: HTTP ${res.status}`)
    }

    const xml = await res.text()
    keys.push(...extractTagValues(xml, 'Key'))

    const isTruncated = /<IsTruncated>true<\/IsTruncated>/.test(xml)
    continuationToken = isTruncated ? extractTagValues(xml, 'NextContinuationToken')[0] : undefined
  } while (continuationToken)

  return keys
}

/** 有限並行度地逐筆刪除物件；DeleteObject 對不存在的 key 仍視為成功（冪等），不需要先檢查是否存在 */
async function deleteKeys(client: AwsClient, config: S3Config, keys: string[]): Promise<void> {
  const base = bucketBaseUrl(config)
  const CONCURRENCY = 20

  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    const batch = keys.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (key) => {
        const url = `${base}/${key.split('/').map(encodeURIComponent).join('/')}`
        const res = await client.fetch(url, { method: 'DELETE', headers: cfAccessHeaders(config) })
        return { key, ok: res.ok || res.status === 404 }
      }),
    )

    const failed = results.filter((r) => !r.ok)
    if (failed.length > 0) {
      throw new Error(`刪除物件失敗: ${failed.map((f) => f.key).join(', ')}`)
    }
  }
}

/**
 * 依 prefix 批次刪除物件，內部處理 ListObjectsV2 分頁。prefix 底下沒有任何物件時視為成功（冪等）。
 * 用有限並行度的逐筆 DELETE，而非 S3 DeleteObjects 批次 API：Workers 的 Web Crypto 不支援 MD5，
 * 而 DeleteObjects 批次 API 通常需要 Content-MD5 header，逐筆刪除可以避開這個限制。
 */
export async function deleteByPrefix(env: Env, prefix: string): Promise<void> {
  const config = getS3Config(env)
  const client = createS3Client(config)

  const keys = await listAllKeys(client, config, prefix)
  if (keys.length === 0) return

  await deleteKeys(client, config, keys)
}
