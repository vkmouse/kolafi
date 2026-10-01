import type { Env } from '../types'

/**
 * 物件儲存存取層，直接使用 Cloudflare R2 binding（env.BUCKET），單一 bucket，
 * 物件 key 規則：
 *
 *   assets/{source_id}/{asset_id}{extension}   原始素材檔
 *   thumbs/{source_id}/{asset_id}.jpg          縮圖
 *   exports/{project_id}/...                   匯出檔
 *
 * source_id 對 USER 類型素材固定為 "USER"，對 PROJECT 類型素材為 project_id。
 */

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

/** 沒綁定 R2 時直接報錯，避免悄悄失敗 */
function getBucket(env: Env): R2Bucket {
  if (!env.BUCKET) {
    throw new Error('物件儲存未設定：缺少 R2 binding「BUCKET」')
  }
  return env.BUCKET
}

export async function putObject(env: Env, key: string, body: Blob | ArrayBuffer, contentType: string): Promise<void> {
  await getBucket(env).put(key, body, contentType ? { httpMetadata: { contentType } } : undefined)
}

export interface StoredObject {
  /** 二進位內容的串流，直接接到 Response body 使用，不在記憶體中整份緩衝 */
  body: ReadableStream<Uint8Array>
}

/** 找不到物件回傳 null，由呼叫端決定錯誤訊息（檔案或縮圖不存在） */
export async function getObject(env: Env, key: string): Promise<StoredObject | null> {
  const object = await getBucket(env).get(key)
  return object ? { body: object.body } : null
}

/** 對不存在的 key 仍視為成功（冪等） */
export async function deleteObject(env: Env, key: string): Promise<void> {
  await getBucket(env).delete(key)
}

/** 依 prefix 批次刪除物件，內部處理 list 分頁；prefix 底下沒有任何物件時視為成功（冪等） */
export async function deleteByPrefix(env: Env, prefix: string): Promise<void> {
  const bucket = getBucket(env)
  let cursor: string | undefined

  do {
    const listed = await bucket.list({ prefix, cursor, limit: 1000 })
    if (listed.objects.length > 0) {
      await bucket.delete(listed.objects.map((o) => o.key))
    }
    cursor = listed.truncated ? listed.cursor : undefined
  } while (cursor)
}
