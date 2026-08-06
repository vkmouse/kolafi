import type { Env } from '../types'

const CREATE_TABLE_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    extension TEXT NOT NULL,
    type TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    has_thumbnail INTEGER NOT NULL DEFAULT 0
  )`,
  // assets.type: 素材類型 — IMAGE, VIDEO
  // assets.source_type: 來源類型 — USER, PROJECT

  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS project_assets (
    project_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    is_selected INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (project_id, asset_id)
  )`,

  `CREATE TABLE IF NOT EXISTS project_exports (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS project_tags (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_selected INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_selected INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('DOWNLOAD', 'EXPORT', 'CLEANUP', 'THUMBNAIL', 'TAG', 'CAPTION')),
    project_id TEXT,
    user_id TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED')),
    created_at INTEGER NOT NULL
  )`,
  // tasks.type: 任務類型 — DOWNLOAD, EXPORT, CLEANUP, THUMBNAIL, TAG, CAPTION
  // tasks.status: 任務狀態 — PENDING, PROCESSING, SUCCESS, FAILED

  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS user_projects (
    user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING', 'PUBLISHED')),
    caption TEXT NOT NULL DEFAULT '',
    export_params TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, project_id)
  )`,
  // user_projects.status: 使用者專案狀態 — DRAFT, PENDING, PUBLISHED
  // user_projects.export_params: JSON 字串

  `CREATE TABLE IF NOT EXISTS user_configs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    config_name TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  )`,
  // user_configs.data: JSON 字串

  // --- 索引 ---
  // 依專案+使用者過濾後常要取最新一筆，DESC 讓排序直接吃索引不必額外排序
  `CREATE INDEX IF NOT EXISTS idx_project_exports_project_user_created
    ON project_exports (project_id, user_id, created_at DESC)`,

  // 專案清單頁「是否有進行中任務」的高頻查詢，缺索引會整張表掃過一輪
  `CREATE INDEX IF NOT EXISTS idx_tasks_project_status_type
    ON tasks (project_id, status, type)`,

  // Worker 輪詢用的「依類型撈最舊 PENDING」查詢，等值條件在前、排序鍵在後
  `CREATE INDEX IF NOT EXISTS idx_tasks_type_status_created
    ON tasks (type, status, created_at)`,

  // 依專案查詢時多半也要照 sort_order 排序
  `CREATE INDEX IF NOT EXISTS idx_project_tags_project_sort
    ON project_tags (project_id, sort_order)`,

  // asset_id 只出現在複合主鍵的第二欄，反查用不到既有索引
  `CREATE INDEX IF NOT EXISTS idx_project_assets_asset
    ON project_assets (asset_id)`,

  // 建立專案時的高頻查詢，資料量會隨使用者數線性成長
  `CREATE INDEX IF NOT EXISTS idx_user_configs_user_config_name
    ON user_configs (user_id, config_name)`,

  // 全域掃描待補縮圖的素材，即使值只有 0/1，資料量大時仍比全表掃描省時
  `CREATE INDEX IF NOT EXISTS idx_assets_has_thumbnail
    ON assets (has_thumbnail)`,

  // 級聯刪除依來源反查素材，缺索引會整張表掃過一輪
  `CREATE INDEX IF NOT EXISTS idx_assets_source_type_id
    ON assets (source_type, source_id)`,

  // user_projects 的 PK 是 (user_id, project_id)，用 project_id 反查沒有索引可用
  `CREATE INDEX IF NOT EXISTS idx_user_projects_project_status
    ON user_projects (project_id, status)`,
]

const SEED_USERS: Array<{ id: string; name: string }> = [
  { id: '2e3c8af2-2b49-42db-a687-de51a901ea69', name: '天' },
  { id: '796ff417-0f71-44e9-8ba3-e1f8fa063b97', name: '虎' },
]

const SEED_USER_CONFIGS: Array<{ id: string; user_id: string; config_name: string; data: Record<string, unknown> }> = [
  { id: 'fd712244-9a71-486f-bea6-edbd3a2ef195', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'CAPTION', data: { path: '/app/prompts/prompt1.txt' } },
  { id: '337e1b10-876a-44e9-a89e-bea0057bf79f', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'CAPTION', data: { path: '/app/prompts/prompt2.txt' } },
  { id: 'b686d23f-3885-499f-b1aa-d1c0521f8049', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'CAPTION', data: { path: '/app/prompts/prompt3.txt' } },
  { id: 'ce896997-5d31-4ff6-91cd-d36a48a43452', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'CAPTION', data: { path: '/app/prompts/prompt4.txt' } },
  { id: '0406d8e4-8b89-4f4f-bf6d-677c9d90e23f', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'CAPTION', data: { path: '/app/prompts/prompt5.txt' } },
  { id: '44022ff5-a29e-491b-a3d8-f440d6ab990c', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'EXPORT_BGM', data: { path: '/app/materials/cute-cheerful-whistle-music-394093.mp3', volume: 0.3 } },
  { id: '529e3b9d-431a-4d28-ad1a-365a81cdb098', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'EXPORT_BGM', data: { path: '/app/materials/cute-whistle-ukulele-music-260565.mp3', volume: 0.3 } },
  { id: '4b2a3ae4-910d-4d24-ab9d-687aee1d8ff5', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'EXPORT_BGM', data: { path: '/app/materials/good-day-301819.mp3', volume: 0.3 } },
  { id: 'bd961dfe-b73f-4e86-b8bc-7fff88f7eb94', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'EXPORT_BGM', data: { path: '/app/materials/chilltapefm-morning-breeze-383960.mp3', volume: 0.3 } },
  { id: 'f9c6d4db-0b74-4fda-b920-d270113e828e', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'EXPORT_BGM', data: { path: '/app/materials/fassounds-good-morning-upbeat-happy-ukulele-244395.mp3', volume: 0.3 } },
  { id: '069f51e8-1862-4d0a-98b4-74d32c06676c', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'EXPORT_BGM', data: { path: '/app/materials/lkoliks-ukulele-cute-joyful-music-400908.mp3', volume: 0.3 } },
  { id: '100cf551-307c-4d4f-89ca-a1df37a1e254', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'EXPORT_BGM', data: { path: '/app/materials/vlog-music-content-cute-background-music-9-465624.mp3', volume: 0.3 } },
  { id: '2fafdbcc-b4fe-4736-a7a5-0a5e661aaf31', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'EXPORT_BGM', data: { path: '/app/materials/2_23_AM.mp3', volume: 0.3 } },
  { id: '0401be64-bd58-488c-b1f4-59d78f1b4a15', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'EXPORT_BGM', data: { path: '/app/materials/3_03_PM.mp3', volume: 0.3 } },
  { id: 'b601c5e0-b400-48e7-9cfa-60882db1b636', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'EXPORT_BGM', data: { path: '/app/materials/Happy_Family_by_Trending_Music.mp3', volume: 0.3 } },
  { id: '3ba6a736-a5e6-4d87-89e4-088d6f069ab7', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'EXPORT_BGM', data: { path: '/app/materials/So_Cute.mp3', volume: 0.3 } },
  { id: '8affbe67-e710-449d-92bd-07b07a462804', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'EXPORT_SUBTITLE', data: { font: 'Noto-Sans-CJK-TC-Bold', fontsize: 65, color: 'white', stroke_color: 'black', position: 0.75 } },
  { id: '29cc2d71-aa19-49b9-a4d6-0e9ed017efe5', user_id: '2e3c8af2-2b49-42db-a687-de51a901ea69', config_name: 'EXPORT_VOICE', data: { tts_model: 'zh-TW-HsiaoChenNeural', rate: '+100%', pitch: '+0Hz' } },
  { id: 'ad2c39ba-d2a7-4e38-9652-d4cb4ab5d16f', user_id: '796ff417-0f71-44e9-8ba3-e1f8fa063b97', config_name: 'CAPTION', data: { path: '/app/prompts/prompt101.txt' } },
  { id: 'd1a2d0af-4785-4619-8949-ac856c51ef6b', user_id: '796ff417-0f71-44e9-8ba3-e1f8fa063b97', config_name: 'EXPORT_BGM', data: { path: '/app/materials/rubyzephyr-morning-steps-v1-452475.mp3', volume: 0.2 } },
  { id: '341facf2-29a4-466a-a708-a324b28d1eae', user_id: '796ff417-0f71-44e9-8ba3-e1f8fa063b97', config_name: 'EXPORT_BGM', data: { path: '/app/materials/backgroundmusicmaster-sunny-morning-stroll-375304.mp3', volume: 0.2 } },
  { id: '51826f1b-0cfc-487d-b277-6e724b148a06', user_id: '796ff417-0f71-44e9-8ba3-e1f8fa063b97', config_name: 'EXPORT_BGM', data: { path: '/app/materials/mfcc-ukulele-ukulele-joyful-cute-music-345390.mp3', volume: 0.2 } },
  { id: '8c7890b1-615d-46fe-a411-bb629a0e2ffa', user_id: '796ff417-0f71-44e9-8ba3-e1f8fa063b97', config_name: 'EXPORT_BGM', data: { path: '/app/materials/kaazoom-golden-dayz-upbeat-ukulele-334188.mp3', volume: 0.2 } },
  { id: 'c77521ab-1be2-440e-ac52-b4896b83559d', user_id: '796ff417-0f71-44e9-8ba3-e1f8fa063b97', config_name: 'EXPORT_SUBTITLE', data: { font: 'Noto-Sans-CJK-TC-Black', fontsize: 65, color: '#FF985A', stroke_color: '#332016', position: 0.75 } },
  { id: '38cffc8e-4262-4e1f-8b4a-79f18048ac9f', user_id: '796ff417-0f71-44e9-8ba3-e1f8fa063b97', config_name: 'EXPORT_VOICE', data: { tts_model: 'zh-TW-YunJheNeural', rate: '+50%', pitch: '+18Hz' } },
  { id: 'a0e0b0d5-14ea-4d6b-8b3e-731029a134b2', user_id: '796ff417-0f71-44e9-8ba3-e1f8fa063b97', config_name: 'EXPORT_FRAME', data: { path: '/app/materials/大老虎套圖框_1080x1920.png' } },
]

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB } = context.env

  try {
    // D1Database.exec() 用換行切多個陳述式而非真正解析 SQL，跨多行寫的 CREATE TABLE
    // 會被切壞噴 incomplete input（見 cloudflare/workers-sdk#9133），改用逐一 prepare().run()
    for (const stmt of CREATE_TABLE_STATEMENTS) {
      await DB.prepare(stmt).run()
    }

    const now = Date.now()

    const insertUserSql = `INSERT INTO users (id, name, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT (id) DO NOTHING`

    const insertConfigSql = `INSERT INTO user_configs (id, user_id, config_name, data, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        user_id = excluded.user_id,
        config_name = excluded.config_name,
        data = excluded.data`

    const userStatements = SEED_USERS.map((u) =>
      DB.prepare(insertUserSql).bind(u.id, u.name, now)
    )

    const configStatements = SEED_USER_CONFIGS.map((c) =>
      DB.prepare(insertConfigSql).bind(c.id, c.user_id, c.config_name, JSON.stringify(c.data), now)
    )

    await DB.batch([...userStatements, ...configStatements])

    return Response.json({
      success: true,
      message: 'Database initialization completed successfully',
    })
  } catch (err) {
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
