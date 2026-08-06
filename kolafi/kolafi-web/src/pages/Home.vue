<template>
  <div class="page-container">
    <!-- 頁面標頭 -->
    <header class="page-header">
      <h1 class="page-title">儀表板</h1>
      <UserAvatar />
    </header>

    <!-- 專案總覽 -->
    <div class="module-card">
      <div class="card-header">
        <h2 class="card-title">專案總覽 ({{ projectStats.total }})</h2>
        <router-link to="/projects" class="card-meta">查看全部 ></router-link>
      </div>
      <div class="card-body">
        <router-link to="/projects?status=DRAFT" class="stat-item">
          <div class="stat-count">{{ projectStats.draft }}</div>
          <div class="stat-label">未處理</div>
        </router-link>
        <router-link to="/projects?status=PENDING" class="stat-item">
          <div class="stat-count">{{ projectStats.pending }}</div>
          <div class="stat-label">待發佈</div>
        </router-link>
        <router-link to="/projects?status=PUBLISHED" class="stat-item">
          <div class="stat-count">{{ projectStats.published }}</div>
          <div class="stat-label">已發佈</div>
        </router-link>
      </div>
    </div>

    <!-- 素材庫總覽 -->
    <div class="module-card">
      <div class="card-header">
        <h2 class="card-title">素材庫總覽 ({{ assetStats.total }})</h2>
        <router-link to="/assets" class="card-meta">查看全部 ></router-link>
      </div>
      <div class="card-body">
        <router-link to="/assets?filter=unused" class="stat-item">
          <div class="stat-count">{{ assetStats.unused }}</div>
          <div class="stat-label">未使用</div>
        </router-link>
        <router-link to="/assets?filter=image" class="stat-item">
          <div class="stat-count">{{ assetStats.image }}</div>
          <div class="stat-label">圖片</div>
        </router-link>
        <router-link to="/assets?filter=video" class="stat-item">
          <div class="stat-count">{{ assetStats.video }}</div>
          <div class="stat-label">影片</div>
        </router-link>
      </div>
    </div>

    <!-- 任務總覽 -->
    <div class="module-card">
      <div class="card-header">
        <h2 class="card-title">任務中總覽 ({{ taskTotal }})</h2>
      </div>
      <div class="card-body">
        <div class="stat-item" @click="viewTasks('export')">
          <div class="stat-count">{{ taskStats.export }}</div>
          <div class="stat-label">匯出影片</div>
        </div>
        <div class="stat-item" @click="viewTasks('download')">
          <div class="stat-count">{{ taskStats.download }}</div>
          <div class="stat-label">圖片下載</div>
        </div>
        <div class="stat-item" @click="viewTasks('generate')">
          <div class="stat-count">{{ taskStats.generate }}</div>
          <div class="stat-label">產生文案</div>
        </div>
        <div class="stat-item" @click="viewTasks('tagging')">
          <div class="stat-count">{{ taskStats.tagging }}</div>
          <div class="stat-label">自動標籤</div>
        </div>
      </div>
    </div>

    <!-- 標籤管理 -->
    <div class="module-card">
      <div class="card-header">
        <div class="card-header-inline">
          <h2 class="card-title">標籤管理</h2>
          <button class="icon-btn" @click="toggleTagManagement" :title="isTagManagementMode ? '返回' : '管理模式'">
            <img :src="isTagManagementMode ? EditIconActive : EditIcon" alt="Edit" class="icon-img" />
          </button>
        </div>
      </div>

      <div v-if="!isTagManagementMode" class="selected-tags-display">
        <div v-if="selectedTags.length === 0" class="empty-tags">尚未選擇任何標籤</div>
        <div v-else class="tags-list">
          <span v-for="tag in selectedTags" :key="tag.id" class="tag-chip">
            #{{ tag.name }}
          </span>
        </div>
      </div>

      <div v-if="isTagManagementMode" class="tag-management-container">
        <div class="tag-input-section">
          <input
            v-model="newTagName"
            type="text"
            placeholder="輸入新標籤名稱"
            @keyup.enter="addNewTag"
            class="tag-input"
          />
          <button class="btn-secondary" @click="addNewTag">新增標籤</button>
        </div>

        <div class="tag-section">
          <h3 class="section-title">已選擇標籤 ({{ localSelectedTags.length }})</h3>
          <div
            class="tags-container"
            ref="selectedContainer"
            @dragover.prevent="handleDragOver($event, 'selected')"
            @drop="handleDrop($event, 'selected')"
            @dragenter.prevent
          >
            <div v-if="localSelectedTags.length === 0" class="empty-tags">
              點擊下方標籤來選擇
            </div>
            <div
              v-for="(tag, index) in localSelectedTags"
              :key="tag.id"
              :data-tag-id="tag.id"
              class="tag-item draggable"
              draggable="true"
              @dragstart="handleDragStart($event, tag, 'selected', index)"
              @dragend="handleDragEnd"
              @dragover.prevent="handleDragOverItem($event)"
              @click="moveTagToUnselected(tag)"
            >
              <span class="drag-handle">⋮⋮</span>
              {{ tag.name }}
            </div>
          </div>
        </div>

        <div class="tag-section">
          <h3 class="section-title">未選擇標籤 ({{ localUnselectedTags.length }})</h3>
          <div
            class="tags-container"
            ref="unselectedContainer"
            @dragover.prevent="handleDragOver($event, 'unselected')"
            @drop="handleDrop($event, 'unselected')"
            @dragenter.prevent
          >
            <div v-if="localUnselectedTags.length === 0" class="empty-tags">
              所有標籤都已選擇
            </div>
            <div
              v-for="tag in localUnselectedTags"
              :key="tag.id"
              class="tag-item"
              draggable="true"
              @dragstart="handleDragStart($event, tag, 'unselected')"
              @dragend="handleDragEnd"
              @click="moveTagToSelected(tag)"
            >
              {{ tag.name }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 系統工具 -->
    <div class="module-card">
      <div class="card-header">
        <h2 class="card-title">系統工具</h2>
      </div>
      <div class="card-body">
        <button class="btn-action" @click="generateThumbnails" :disabled="thumbnailLoading || hasPendingThumbnailTask">
          <span v-if="hasPendingThumbnailTask" class="badge task-badge">任務中</span>
          <img :src="ThumbnailIcon" alt="Thumbnail" class="btn-icon-img" />
          <div class="btn-content">
            <span class="btn-text">產生縮圖</span>
            <span class="btn-desc">沒有縮圖的素材產生縮圖</span>
          </div>
        </button>
        <button class="btn-action" @click="autoCleanup" :disabled="cleanupLoading || hasPendingCleanupTask">
          <span v-if="hasPendingCleanupTask" class="badge task-badge">任務中</span>
          <img :src="CleanupIcon" alt="Cleanup" class="btn-icon-img" />
          <div class="btn-content">
            <span class="btn-text">自動清理</span>
            <span class="btn-desc">清理已發佈未使用的素材</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  createCleanupTask, 
  createThumbnailTasks,
  getCleanupTasks,
  getThumbnailTasks 
} from '../services/taskService'
import { getAssetsStats } from '../services/assetService'
import { getProjectsStats } from '../services/projectService'
import {
  getTags,
  createTag,
  updateTagSelection,
  reorderTags
} from '../services/tagService'
import ThumbnailIcon from '../components/icons/ThumbnailIcon.svg'
import CleanupIcon from '../components/icons/CleanupIcon.svg'
import EditIcon from '../components/icons/EditIcon.svg'
import EditIconActive from '../components/icons/EditIcon-active.svg'
import UserAvatar from '../components/UserAvatar.vue'

// 專案統計數據
const projectStats = ref({
  total: 0,
  pending: 0,
  draft: 0,
  published: 0
})

// 素材統計數據
const assetStats = ref({
  total: 0,
  unused: 0,
  image: 0,
  video: 0
})

// 任務統計數據
const taskStats = ref({
  export: 0,
  download: 0,
  generate: 0,
  tagging: 0
})

// 任務總數
const taskTotal = computed(() => {
  return taskStats.value.export + taskStats.value.download + taskStats.value.generate + taskStats.value.tagging
})

// ===== 標籤管理功能 =====
const allTags = ref([])
const isTagManagementMode = ref(false)
const newTagName = ref('')
const localSelectedTags = ref([])
const localUnselectedTags = ref([])
const selectedContainer = ref(null)
const unselectedContainer = ref(null)

let draggedTag = null
let draggedFrom = null
let draggedIndex = null
let draggedElement = null

const selectedTags = computed(() => {
  return allTags.value
    .filter(tag => tag.isSelected)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
})

const loadTags = async () => {
  try {
    const response = await getTags()
    if (response.success && response.data) {
      allTags.value = response.data.map(tag => ({
        id: tag.id,
        name: tag.name,
        isSelected: tag.is_selected,
        sortOrder: tag.sort_order || 0
      }))
    }
  } catch (error) {
    console.error('載入標籤失敗:', error)
  }
}

const toggleTagManagement = () => {
  if (isTagManagementMode.value) {
    exitTagManagement()
  } else {
    enterTagManagement()
  }
}

const enterTagManagement = () => {
  isTagManagementMode.value = true
  const selected = allTags.value
    .filter(tag => tag.isSelected)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(tag => ({ ...tag }))
  const unselected = allTags.value
    .filter(tag => !tag.isSelected)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(tag => ({ ...tag }))

  localSelectedTags.value = selected
  localUnselectedTags.value = unselected
  newTagName.value = ''
}

const exitTagManagement = async () => {
  isTagManagementMode.value = false
  localSelectedTags.value = []
  localUnselectedTags.value = []
  newTagName.value = ''
  await loadTags()
}

const addNewTag = async () => {
  if (!newTagName.value.trim()) return

  try {
    const response = await createTag(newTagName.value.trim())
    if (response.success && response.data) {
      const newTag = {
        id: response.data.id,
        name: response.data.name,
        isSelected: response.data.is_selected ?? true,
        sortOrder: localSelectedTags.value.length
      }
      localSelectedTags.value.push(newTag)
      newTagName.value = ''
      await loadTags()
    } else {
      console.error('新增標籤失敗:', response.error)
    }
  } catch (error) {
    console.error('新增標籤失敗:', error)
  }
}

const moveTagToSelected = async (tag) => {
  const index = localUnselectedTags.value.findIndex(t => t.id === tag.id)
  if (index >= 0) {
    localUnselectedTags.value.splice(index, 1)
    localSelectedTags.value.push({ ...tag, isSelected: true })

    try {
      await updateTagSelection(tag.id, true)
      const tagInAll = allTags.value.find(t => t.id === tag.id)
      if (tagInAll) {
        tagInAll.isSelected = true
      }
      await loadTags()
    } catch (error) {
      console.error('更新標籤選擇狀態失敗:', error)
      const idx = localSelectedTags.value.findIndex(t => t.id === tag.id)
      if (idx >= 0) {
        localSelectedTags.value.splice(idx, 1)
        localUnselectedTags.value.push(tag)
      }
    }
  }
}

const moveTagToUnselected = async (tag) => {
  const index = localSelectedTags.value.findIndex(t => t.id === tag.id)
  if (index >= 0) {
    localSelectedTags.value.splice(index, 1)
    localUnselectedTags.value.push({ ...tag, isSelected: false })

    try {
      await updateTagSelection(tag.id, false)
      const tagInAll = allTags.value.find(t => t.id === tag.id)
      if (tagInAll) {
        tagInAll.isSelected = false
      }
      await loadTags()
    } catch (error) {
      console.error('更新標籤選擇狀態失敗:', error)
      const idx = localUnselectedTags.value.findIndex(t => t.id === tag.id)
      if (idx >= 0) {
        localUnselectedTags.value.splice(idx, 1)
        localSelectedTags.value.push(tag)
      }
    }
  }
}

const handleDragStart = (event, tag, from, index = null) => {
  draggedTag = tag
  draggedFrom = from
  draggedIndex = index
  draggedElement = event.target
  event.target.classList.add('dragging')

  if (from === 'selected' && selectedContainer.value) {
    selectedContainer.value.classList.add('drag-active')
  } else if (from === 'unselected' && unselectedContainer.value) {
    unselectedContainer.value.classList.add('drag-active')
  }
}

const handleDragEnd = (event) => {
  event.target.classList.remove('dragging')

  if (selectedContainer.value) {
    selectedContainer.value.classList.remove('drag-active')
  }
  if (unselectedContainer.value) {
    unselectedContainer.value.classList.remove('drag-active')
  }

  draggedTag = null
  draggedFrom = null
  draggedIndex = null
  draggedElement = null
}

const handleDragOverItem = (event) => {
  if (!draggedElement || !draggedTag) return
  if (event.target === draggedElement) return

  const targetItem = event.target.closest('.tag-item')
  if (!targetItem || !targetItem.classList.contains('draggable')) return
  if (draggedFrom !== 'selected') return

  const container = targetItem.parentElement
  const allItems = [...container.querySelectorAll('.tag-item.draggable')]
  const draggedIdx = allItems.indexOf(draggedElement)
  const targetIdx = allItems.indexOf(targetItem)

  if (draggedIdx < targetIdx) {
    targetItem.after(draggedElement)
  } else {
    targetItem.before(draggedElement)
  }
}

const handleDragOver = (event) => {
  event.preventDefault()
}

const handleDrop = async (event, section) => {
  event.preventDefault()

  if (!draggedTag) return

  if (draggedFrom !== section) {
    if (section === 'selected') {
      await moveTagToSelected(draggedTag)
    } else {
      await moveTagToUnselected(draggedTag)
    }
    return
  }

  if (section === 'selected') {
    const container = selectedContainer.value
    if (!container) return
    const items = [...container.querySelectorAll('.tag-item.draggable')]
    const newOrder = items
      .map(item => {
        const tagId = item.getAttribute('data-tag-id')
        return localSelectedTags.value.find(t => t.id === tagId)
      })
      .filter(Boolean)

    localSelectedTags.value = newOrder

    try {
      const allTagIds = [
        ...newOrder.map(tag => tag.id),
        ...localUnselectedTags.value.map(tag => tag.id)
      ]
      if (allTagIds.length > 0) {
        await reorderTags(allTagIds)
        newOrder.forEach((tag, index) => {
          const tagInAll = allTags.value.find(t => t.id === tag.id)
          if (tagInAll) {
            tagInAll.sortOrder = index
          }
        })
        await loadTags()
      }
    } catch (error) {
      console.error('更新標籤排序失敗:', error)
    }
  }
}

// 載入統計數據
const loadStats = async () => {
  try {
    // 獲取專案統計數據
    const projectsResult = await getProjectsStats()
    if (projectsResult.success && projectsResult.data) {
      projectStats.value = {
        total: projectsResult.data.total || 0,
        pending: projectsResult.data.pending || 0,
        draft: projectsResult.data.draft || 0,
        published: projectsResult.data.published || 0
      }
    }

    // 獲取素材統計數據
    const assetsResult = await getAssetsStats()
    if (assetsResult.success && assetsResult.data) {
      assetStats.value = {
        total: assetsResult.data.total || 0,
        unused: assetsResult.data.unused || 0,
        image: assetsResult.data.image || 0,
        video: assetsResult.data.video || 0
      }
    }
  } catch (error) {
    console.error('載入統計數據失敗:', error)
  }
}

// 任務狀態
const hasPendingThumbnailTask = ref(false)
const hasPendingCleanupTask = ref(false)

// 檢查任務狀態
const checkTaskStatus = async () => {
  try {
    // 檢查縮圖任務
    const thumbnailResult = await getThumbnailTasks()
    if (thumbnailResult.success && thumbnailResult.data) {
      hasPendingThumbnailTask.value = thumbnailResult.data.some(
        task => task.status === 'PENDING' || task.status === 'PROCESSING'
      )
    }

    // 檢查清理任務
    const cleanupResult = await getCleanupTasks()
    if (cleanupResult.success && cleanupResult.data) {
      hasPendingCleanupTask.value = cleanupResult.data.some(
        task => task.status === 'PENDING' || task.status === 'PROCESSING'
      )
    }
  } catch (error) {
    console.error('檢查任務狀態失敗:', error)
  }
}

// 定期檢查任務狀態
let taskCheckInterval = null

onMounted(() => {
  // 載入統計數據
  loadStats()

  // 載入標籤
  loadTags()
  
  // 立即檢查一次任務狀態
  checkTaskStatus()
  
  // 每5秒檢查一次任務狀態
  taskCheckInterval = setInterval(checkTaskStatus, 5000)
})

onUnmounted(() => {
  // 清除定時器
  if (taskCheckInterval) {
    clearInterval(taskCheckInterval)
  }
})

// 產生縮圖
const thumbnailLoading = ref(false)
const generateThumbnails = async () => {
  if (thumbnailLoading.value) return
  thumbnailLoading.value = true
  console.log('開始產生縮圖')
  
  try {
    const result = await createThumbnailTasks()
    console.log('產生縮圖任務已創建:', result)
    console.log('產生縮圖任務已成功建立！')
    
    // 立即檢查任務狀態
    await checkTaskStatus()
  } catch (error) {
    console.error('產生縮圖任務失敗:', error)
    console.log('建立縮圖任務失敗，請稍後再試')
  } finally {
    thumbnailLoading.value = false
  }
}

// 自動清理
const cleanupLoading = ref(false)
const autoCleanup = async () => {
  if (cleanupLoading.value) return
  cleanupLoading.value = true
  console.log('開始自動清理')
  
  try {
    const result = await createCleanupTask()
    console.log('清理任務已創建:', result)
    console.log('清理任務已成功建立！')
    
    // 立即檢查任務狀態
    await checkTaskStatus()
  } catch (error) {
    console.error('清理任務失敗:', error)
    console.log('建立清理任務失敗，請稍後再試')
  } finally {
    cleanupLoading.value = false
  }
}
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.module-card {
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.card-header-inline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.card-meta {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
}

.card-meta:hover {
  color: var(--shopee-primary);
}

.card-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(50px, 1fr));
  gap: 8px;
}

.icon-btn {
  padding: 6px;
  background: transparent;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  width: 30px;
  height: 30px;
}

.icon-btn:hover {
  background: var(--shopee-primary-light);
  border-color: var(--shopee-primary);
  color: var(--shopee-primary);
}

.icon-img {
  width: 18px;
  height: 18px;
  display: block;
}

/* 系統工具的按鈕佈局 */
.module-card:last-of-type .card-body {
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.stat-item {
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 14px;
  text-decoration: none;
  color: inherit;
  display: block;
  transition: all 0.2s ease;
  cursor: pointer;
}

.stat-item:hover {
  border-color: var(--shopee-primary);
}

.stat-count {
  font-size: 26px;
  font-weight: 700;
  color: var(--shopee-primary);
  margin-bottom: 6px;
  text-align: center;
}

.stat-label {
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  text-align: center;
}

/* 系統工具按鈕樣式 */
.btn-action {
  padding: 14px;
  background: transparent;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 12px;
  transition: all 0.2s ease;
  position: relative;
  text-decoration: none;
}

.btn-action:hover:not(:disabled) {
  border-color: var(--shopee-primary);
}

.btn-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon-img {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 2px;
}

.btn-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  flex: 1;
}

.btn-text {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 6px;
  color: var(--shopee-primary);
  line-height: 1.2;
}

.btn-desc {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  line-height: 1.2;
}

/* ===== 標籤管理樣式 ===== */
.selected-tags-display {
  min-height: 60px;
  padding: 12px;
  background: var(--bg-section);
  border-radius: 8px;
  border: 1px solid var(--border-primary);
}

.empty-tags {
  color: var(--text-secondary);
  font-style: italic;
  font-size: 14px;
  text-align: center;
  padding: 12px 0;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-chip {
  display: inline-block;
  padding: 6px 12px;
  background: var(--shopee-primary);
  color: white;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 500;
}

.tag-management-container {
  background: var(--bg-page);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--border-primary);
}

.tag-input-section {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.tag-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.tag-input:focus {
  outline: none;
  border-color: var(--shopee-primary);
  box-shadow: 0 0 0 3px rgba(238, 77, 45, 0.1);
}

.tag-section {
  margin-bottom: 16px;
}

.tag-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.tags-container {
  min-height: 80px;
  padding: 12px;
  background: var(--bg-card);
  border: 2px solid var(--border-primary);
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: flex-start;
  transition: all 0.2s;
}

.tags-container.drag-active {
  border-color: var(--shopee-primary);
  background: var(--shopee-primary-light);
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: var(--bg-section);
  color: var(--text-primary);
  border-radius: 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
  border: 2px solid transparent;
}

.tag-item:hover {
  background: var(--shopee-primary-light);
  border-color: var(--shopee-primary);
  transform: translateY(-1px);
}

.tag-item.draggable {
  cursor: move;
}

.tag-item.dragging {
  opacity: 0.5;
  transform: scale(0.95);
}

.drag-handle {
  color: var(--text-secondary);
  font-size: 12px;
  cursor: move;
}

.tag-item:hover .drag-handle {
  color: var(--shopee-primary);
}

/* 徽章樣式 */
.badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  position: absolute;
  right: 8px;
  top: 8px;
}

.task-badge {
  background: var(--shopee-primary-light);
  color: var(--shopee-primary);
}

@media (max-width: 768px) {  
  .module-card {
    padding: 8px;
  }
  
  .card-title {
    font-size: 14px;
  }
  
  .card-meta {
    font-size: 12px;
  }
  
  .card-body {
    gap: 4px;
  }
  
  .module-card:last-of-type .card-body {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-item {
    border-radius: 4px;
    padding: 12px 10px;
  }
  
  .stat-count {
    font-size: 16px;
    margin-bottom: 4px;
  }
  
  .stat-label {
    font-size: 12px;
  }
  
  .btn-action {
    padding: 12px;
    gap: 10px;
    border-radius: 4px;
  }
  
  .btn-text {
    font-size: 12px;
    margin-bottom: 4px;
  }
  
  .btn-desc {
    font-size: 10px;
  }
}
</style>
