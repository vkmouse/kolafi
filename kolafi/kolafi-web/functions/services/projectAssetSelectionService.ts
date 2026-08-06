import { findMissingProjectAssetIds, overwriteSelectedAssets } from '../repositories/projectAssetRepository'

export type ApplyAssetSelectionResult = { ok: true } | { ok: false; error: string; status: number }

/** 選定前先驗證 id 是否都在池子裡，避免選到不存在的 project_assets 關聯 */
export async function applyAssetSelection(projectId: string, assetIds: string[], DB: D1Database): Promise<ApplyAssetSelectionResult> {
  const missingAssetIds = await findMissingProjectAssetIds(projectId, assetIds, DB)
  if (missingAssetIds.length > 0) {
    return { ok: false, error: `素材尚未加入專案素材池: ${missingAssetIds.join(', ')}`, status: 400 }
  }

  await overwriteSelectedAssets(projectId, assetIds, DB)
  return { ok: true }
}
