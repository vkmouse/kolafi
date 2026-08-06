<template>
  <div class="page-container">
    <!-- 頁面標頭 -->
    <header class="page-header">
      <button class="btn-back" @click="goBack">
        <img :src="BackIcon" alt="Back" class="icon-img" />
      </button>
      <div class="page-title-section">
        <h1 class="page-title">{{ project.name || '載入中...' }}</h1>
      </div>
      <UserAvatar />
    </header>

    <!-- 專案狀態 -->
    <div class="module-card">
      <div class="status-buttons">
        <button
          v-for="status in statusOptions"
          :key="status.value"
          class="status-btn"
          :class="{ active: project.status === status.value }"
          :disabled="isUpdatingStatus"
          @click="updateStatus(status.value)"
        >
          {{ status.label }}
        </button>
      </div>
    </div>

    <!-- 專案管理區塊 -->
    <div class="module-card">
      <div class="card-header">
        <div class="card-header-inline">
          <h2 class="card-title">專案管理</h2>
          <button class="icon-btn" @click="toggleProjectManagement" :title="isProjectManagementMode ? '返回' : '管理模式'">
            <img :src="isProjectManagementMode ? EditIconActive : EditIcon" alt="Edit" class="icon-img" />
          </button>
        </div>
        <div v-if="!isProjectManagementMode" class="actions-row">
          <button class="btn-secondary" @click="copyProjectName" :disabled="!project.name" :class="{ 'success': copyNameSuccess }">
            {{ copyNameSuccess ? '已複製' : '複製名稱' }}
          </button>
          <button class="btn-secondary" @click="autoGenerateCaption" :disabled="isCaptionTaskRunning">
            {{ isCaptionTaskRunning ? '產生中...' : '自動產生' }}
          </button>
        </div>
      </div>

      <!-- 一般模式：顯示文案內容 -->
      <div v-if="!isProjectManagementMode" class="project-caption-display">
        <div v-if="!project.caption" class="empty-caption">尚未設定匯出文案</div>
        <div v-else class="caption-content">{{ project.caption }}</div>
      </div>

      <!-- 管理模式：編輯專案名稱和文案 -->
      <div v-if="isProjectManagementMode" class="project-management-container">
        <div class="form-group">
          <label class="form-label">專案名稱</label>
          <input
            v-model="editingProjectName"
            type="text"
            class="form-input"
            placeholder="請輸入專案名稱..."
          />
        </div>

        <div class="form-group">
          <label class="form-label">匯出文案</label>
          <textarea
            v-model="editingCaption"
            class="form-textarea"
            placeholder="請輸入匯出影片的文案內容..."
            rows="4"
          ></textarea>
        </div>

        <div class="form-actions">
          <button 
            class="btn-primary" 
            @click="saveProjectManagement" 
            :disabled="!hasProjectManagementChanges || !editingProjectName.trim()"
          >
            儲存變更
          </button>
        </div>
      </div>
    </div>

    <!-- 標籤管理區塊 -->
    <div class="module-card">
      <div class="card-header">
        <div class="card-header-inline">
          <h2 class="card-title">標籤管理</h2>
          <button class="icon-btn" @click="toggleTagManagement" :title="isTagManagementMode ? '返回' : '管理模式'">
            <img :src="isTagManagementMode ? EditIconActive : EditIcon" alt="Edit" class="icon-img" />
          </button>
        </div>
        <div class="actions-row">
          <button v-if="!isTagManagementMode" class="btn-secondary" @click="copyTags" :class="{ 'success': copyTagsSuccess }">
            {{ copyTagsSuccess ? '已複製' : '複製標籤' }}
          </button>
          <button v-if="!isTagManagementMode" class="btn-secondary" @click="autoGenerateTags" :disabled="isTagTaskRunning">
            {{ isTagTaskRunning ? '產生中...' : '自動標籤' }}
          </button>
        </div>
      </div>

      <!-- 不在管理模式時顯示已選擇的標籤 -->
      <div v-if="!isTagManagementMode" class="selected-tags-display">
        <div v-if="selectedTags.length === 0" class="empty-tags">尚未選擇任何標籤</div>
        <div v-else class="tags-list">
          <span
            v-for="tag in selectedTags"
            :key="tag.id"
            class="tag-chip"
            :class="tag.type === 'global' ? 'tag-chip-global' : 'tag-chip-project'"
          >
            #{{ tag.name }}
          </span>
        </div>
      </div>

      <!-- 在管理模式時顯示標籤管理界面 -->
      <div v-if="isTagManagementMode" class="tag-management-container">
        <!-- 新增標籤輸入框 -->
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

        <!-- 已選擇標籤區塊 -->
        <div class="tag-section">
          <h3 class="section-title">已選擇標籤 ({{ localSelectedTags.length }})</h3>
          <div class="tags-container" 
            ref="selectedContainer"
            @dragover.prevent="handleDragOver($event, 'selected')"
            @drop="handleDrop($event, 'selected')"
            @dragenter.prevent>
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

        <!-- 未選擇標籤區塊 -->
        <div class="tag-section">
          <h3 class="section-title">未選擇標籤 ({{ localUnselectedTags.length }})</h3>
          <div class="tags-container"
            ref="unselectedContainer"
            @dragover.prevent="handleDragOver($event, 'unselected')"
            @drop="handleDrop($event, 'unselected')"
            @dragenter.prevent>
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

        <div class="tag-section">
          <h3 class="section-title">全域標籤 ({{ selectedGlobalTags.length }})</h3>
          <div class="tags-container tags-static">
            <div v-if="selectedGlobalTags.length === 0" class="empty-tags">
              未啟用全域標籤
            </div>
            <span
              v-for="tag in selectedGlobalTags"
              :key="tag.id"
              class="tag-chip tag-chip-global"
            >
              #{{ tag.name }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 匯出影片區塊 -->
    <div class="module-card">
      <div class="card-header">
        <div class="card-header-top">
          <div class="card-header-inline">
            <h2 class="card-title">匯出影片</h2>
            <button class="icon-btn" @click="toggleExportManagement" :title="isExportManagementMode ? '返回' : '管理模式'">
              <img :src="isExportManagementMode ? EditIconActive : EditIcon" alt="Edit" class="icon-img" />
            </button>
          </div>
          <div v-if="latestTask && !isExportManagementMode" class="export-status-info">
            {{ formatTime(latestTask.created_at) }} {{ getStatusText(latestTask.status) }}
          </div>
        </div>
        <div v-if="!isExportManagementMode" class="actions-row">
          <button class="btn-secondary" @click="executeExport" :disabled="isExportTaskRunning">
            {{ isExportTaskRunning ? '匯出中...' : '匯出影片' }}
          </button>
          <button 
            v-if="project.exportUrl" 
            class="btn-secondary" 
            @click="shareVideo"
          >
            分享影片
          </button>
        </div>
      </div>

      <!-- 匯出管理模式 -->
      <div v-if="isExportManagementMode" class="export-management-container">
        <div class="form-group">
          <label class="form-label">解析度 (寬 x 高)</label>
          <div class="resolution-inputs">
            <input v-model.number="localResolutionWidth" type="number" min="1" placeholder="寬" />
            <span>×</span>
            <input v-model.number="localResolutionHeight" type="number" min="1" placeholder="高" />
          </div>
          <div class="form-hint">影片輸出的解析度，預設為 1080x1920</div>
        </div>

        <div class="form-group">
          <label class="form-label">影片長度（秒）</label>
          <input v-model.number="localVideoDuration" type="number" min="1" step="0.1" class="form-input" />
          <div class="form-hint">影片部分的目標長度，預設為 10 秒</div>
        </div>

        <div class="form-group">
          <label class="form-label">總長度（秒）</label>
          <input v-model.number="localTotalDuration" type="number" min="1" step="0.1" class="form-input" />
          <div class="form-hint">輸出影片的總長度（影片 + 圖片），預設為 16 秒</div>
        </div>

        <div v-if="exportErrorMessage" class="form-error">
          {{ exportErrorMessage }}
        </div>

        <div class="form-actions">
          <button class="btn-primary" @click="saveExportOptions" :disabled="isSavingExportOptions">
            {{ isSavingExportOptions ? '儲存中...' : '儲存變更' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 專案素材 -->
    <div class="module-card">
      <div class="card-header">
        <div class="card-header-top">
          <div class="card-header-inline">
            <h2 class="card-title">專案素材</h2>
            <button class="icon-btn" @click="toggleAssetManagement" :title="isAssetManagementMode ? '返回' : '管理模式'">
              <img :src="isAssetManagementMode ? EditIconActive : EditIcon" alt="Edit" class="icon-img" />
            </button>
          </div>
          <div class="selection-stats">
            已選擇 {{ selectedForExportStats.videoCount }} 個影片 / {{ selectedForExportStats.imageCount }} 個圖片
          </div>
        </div>
        <div class="actions-row">
          <button v-if="!isExportSelectMode && !isAssetManagementMode" class="btn-primary" @click="enterExportSelectMode">選擇素材</button>
          <button v-if="!isExportSelectMode && !isAssetManagementMode" class="btn-secondary" @click="autoSearchAssets" :disabled="isDownloadTaskRunning">
            {{ isDownloadTaskRunning ? '搜尋中...' : '自動搜尋' }}
          </button>
          <button v-if="isExportSelectMode" class="btn-primary" @click="confirmExportSelection">確定</button>
          <button v-if="isExportSelectMode" class="btn-secondary" @click="exitExportSelectMode">取消</button>
          <!-- 素材管理菜單 -->
          <button v-if="isAssetManagementMode" class="btn-secondary" @click="openImportModal">匯入素材</button>
          <button v-if="isAssetManagementMode" class="btn-secondary" @click="openUploadAssetModal">上傳素材</button>
        </div>
      </div>

      <div v-if="projectAssets.length === 0" class="empty-state">
        <div class="empty-icon">📦</div>
        <p>此專案尚未有素材</p>
      </div>

      <div v-else class="assets-grid">
        <div
          v-for="asset in projectAssets"
          :key="asset.id"
          class="asset-card"
          :class="{ 
            'export-select-mode': isExportSelectMode,
            'selected': isExportSelectMode && selectedExportIds.includes(asset.id),
            'selected-for-export': !isExportSelectMode && !isAssetManagementMode && project.selectedForExport.includes(asset.id),
            'remove-mode': isAssetManagementMode
          }"
          @click="isExportSelectMode ? toggleExportSelect(asset.id) : null"
        >
          <div class="asset-preview">
            <img v-if="asset.thumbnailPath" :src="asset.thumbnailPath" :alt="asset.id" class="thumbnail-image">
            <div v-else class="preview-placeholder">{{ asset.type === 'image' ? '🖼️' : '🎬' }}</div>
            <span class="badge" :class="`${asset.type}-badge`">
              {{ asset.type === 'image' ? '圖片' : '影片' }}
            </span>
            <span v-if="isExportSelectMode && selectedExportIds.includes(asset.id)" class="select-indicator">✓</span>
            <!-- 移除按鈕 -->
            <button v-if="isAssetManagementMode" class="remove-btn" @click.stop="removeAssetDirectly(asset.id)">
              移除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 匯入素材 Modal -->
    <ImportAssetsModal
      :show="showImportModal"
      :projectId="projectId"
      @close="closeImportModal"
      @imported="handleImport"
    />

    <!-- 上傳素材 Modal -->
    <UploadAssetModal
      :show="showUploadAssetModal"
      :onUpload="handleUploadAssets"
      :isUploading="isUploadingAssets"
      :uploadProgress="uploadProgress"
      :currentFileIndex="currentFileIndex"
      :totalFiles="totalFiles"
      @close="closeUploadAssetModal"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ImportAssetsModal from '../components/modals/ImportAssetsModal.vue'
import UploadAssetModal from '../components/modals/UploadAssetModal.vue'
import BackIcon from '../components/icons/BackIcon.svg'
import EditIcon from '../components/icons/EditIcon.svg'
import EditIconActive from '../components/icons/EditIcon-active.svg'
import UserAvatar from '../components/UserAvatar.vue'
import {
  getProject,
  updateProjectStatus,
  updateProjectName,
  updateProjectCaption,
  updateExportOptions
} from '../services/projectService'
import {
  removeAssetFromProject,
  updateProjectAssets,
  uploadAssetToProject
} from '../services/projectAssetService'
import {
  getProjectTags,
  AddProjectTag,
  updateProjectTagSelection,
  reorderProjectTags
} from '../services/projectTagService'
import { getTags } from '../services/tagService'
import {
  createCaptionTask,
  createTagTask,
  createDownloadTask,
  createExportTask,
  getCaptionTasks,
  getTagTasks,
  getDownloadTasks,
  getExportTasks
} from '../services/taskService'

const route = useRoute()
const router = useRouter()
const projectId = route.params.id

// 返回到專案清單（保留之前的篩選狀態與頁碼，不保留詳情頁歷史）
const goBack = () => {
  const fromStatus = route.query.from
  const fromPage = parseInt(route.query.fromPage) || null
  const query = {}
  if (fromStatus && ['DRAFT', 'PENDING', 'PUBLISHED'].includes(fromStatus)) query.status = fromStatus
  if (fromPage && fromPage > 1) query.page = fromPage
  router.replace({ path: '/projects', query })
}

// 狀態選項
const statusOptions = [
  { value: 'DRAFT', label: '未處理' },
  { value: 'PENDING', label: '待發佈' },
  { value: 'PUBLISHED', label: '已發佈' }
]

// 專案資料
const project = ref({
  id: projectId,
  name: '',
  status: 'DRAFT',
  caption: '',
  exportUrl: null,
  selectedForExport: [],
  exportParams: {
    resolution: '1080x1920',
    videoDuration: 10,
    totalDuration: 17
  }
})

// 匯出文案
const captionText = ref('')
const isSavingCaption = ref(false)

// 專案素材 (已匯入的)
const projectAssets = ref([])

// 選擇匯出統計
const selectedForExportStats = computed(() => {
  const selectedAssets = projectAssets.value.filter(asset => project.value.selectedForExport.includes(asset.id))
  const videoCount = selectedAssets.filter(asset => asset.type === 'video').length
  const imageCount = selectedAssets.filter(asset => asset.type === 'image').length
  return { videoCount, imageCount }
})

// 匯入 Modal
const showImportModal = ref(false)
const isExportSelectMode = ref(false)
const selectedExportIds = ref([])
const isAssetManagementMode = ref(false)

// 專案名稱編輯
const editingProjectName = ref('')

// 專案管理模式
const isProjectManagementMode = ref(false)
const editingCaption = ref('')

// 上傳素材 Modal
const showUploadAssetModal = ref(false)
const isUploadingAssets = ref(false)
const uploadProgress = ref(0)
const currentFileIndex = ref(0)
const totalFiles = ref(0)

// API 加載狀態
const isLoadingProject = ref(false)
const isUpdatingStatus = ref(false)
const errorMessage = ref('')
const copyNameSuccess = ref(false)
const copyTagsSuccess = ref(false)

// 取得專案詳情
const fetchProjectDetails = async () => {
  isLoadingProject.value = true
  errorMessage.value = ''
  try {
    const response = await getProject(projectId)
    if (response.success && response.data) {
      const data = response.data
      project.value = {
        id: data.id,
        name: data.name,
        status: data.status || 'DRAFT',
        selectedForExport: data.asset_ids || [],
        caption: data.caption || '',
        exportUrl: data.export_url || null,
        exportParams: data.export_params ? {
          resolution: data.export_params.resolution || '1080x1920',
          videoDuration: data.export_params.video_duration || 10,
          totalDuration: data.export_params.total_duration || 17
        } : {
          resolution: '1080x1920',
          videoDuration: 10,
          totalDuration: 17
        }
      }
      // 初始化編輯中的專案名稱
      editingProjectName.value = data.name
      editingCaption.value = data.caption || ''
      captionText.value = data.caption || ''
      // 載入專案資產
      if (data.assets && Array.isArray(data.assets)) {
        projectAssets.value = data.assets.map(asset => ({
          id: asset.id,
          extension: asset.extension,
          type: asset.type.toLowerCase(),
          thumbnailPath: asset.thumbnail_path,
          originalPath: asset.original_path
        }))
      }
    }
  } catch (error) {
    console.error('取得專案詳情失敗:', error)
    errorMessage.value = '無法載入專案詳情，請重試'
  } finally {
    isLoadingProject.value = false
  }
}

// 儲存專案名稱
const saveProjectName = async () => {
  if (!editingProjectName.value.trim()) {
    errorMessage.value = '請輸入專案名稱'
    return
  }
  
  try {
    const response = await updateProjectName(projectId, editingProjectName.value)
    if (response.success && response.data) {
      project.value.name = response.data.name
      editingProjectName.value = response.data.name
      errorMessage.value = ''
      console.log('專案名稱已保存:', project.value.name)
    }
  } catch (error) {
    console.error('更新專案名稱失敗:', error)
    errorMessage.value = '更新名稱失敗，請重試'
  }
}

// 通用複製到剪貼板函數，支援手機端
const copyToClipboard = async (text) => {
  try {
    // 嘗試使用現代 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (err) {
    console.warn('Clipboard API failed, trying fallback:', err)
  }

  // 備用方法：使用 document.execCommand
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    
    if (successful) {
      return true
    }
  } catch (err) {
    console.error('Fallback copy method failed:', err)
  }

  return false
}

// 複製專案名稱
const copyProjectName = async () => {
  const success = await copyToClipboard(project.value.name)
  if (success) {
    console.log('專案名稱已複製:', project.value.name)
    copyNameSuccess.value = true
    setTimeout(() => {
      copyNameSuccess.value = false
    }, 3000)
  } else {
    console.error('複製專案名稱失敗')
    // 可以選擇顯示錯誤提示，但這裡先不加
  }
}

// ===== 專案管理模式 =====
const toggleProjectManagement = () => {
  if (isProjectManagementMode.value) {
    exitProjectManagement()
  } else {
    enterProjectManagement()
  }
}

const enterProjectManagement = () => {
  isProjectManagementMode.value = true
  editingProjectName.value = project.value.name
  editingCaption.value = project.value.caption || ''
}

const exitProjectManagement = () => {
  isProjectManagementMode.value = false
}

// 檢查專案管理是否有變更
const hasProjectManagementChanges = computed(() => {
  return editingProjectName.value !== project.value.name || 
         editingCaption.value !== (project.value.caption || '')
})

// 儲存專案管理（名稱和文案）
const saveProjectManagement = async () => {
  if (!editingProjectName.value.trim()) {
    errorMessage.value = '請輸入專案名稱'
    return
  }
  
  try {
    // 儲存專案名稱
    if (editingProjectName.value !== project.value.name) {
      const nameResponse = await updateProjectName(projectId, editingProjectName.value)
      if (nameResponse.success && nameResponse.data) {
        project.value.name = nameResponse.data.name
        editingProjectName.value = nameResponse.data.name
      }
    }
    
    // 儲存文案
    if (editingCaption.value !== project.value.caption) {
      const captionResponse = await updateProjectCaption(projectId, editingCaption.value)
      if (captionResponse.success && captionResponse.data) {
        project.value.caption = captionResponse.data.caption || ''
        captionText.value = captionResponse.data.caption || ''
        editingCaption.value = captionResponse.data.caption || ''
      }
    }
    
    errorMessage.value = ''
    console.log('專案管理資訊已保存')
  } catch (error) {
    console.error('儲存專案管理資訊失敗:', error)
    errorMessage.value = '儲存失敗，請重試'
  }
}

// 更新狀態
const updateStatus = async (newStatus) => {
  if (project.value.status === newStatus) return
  
  isUpdatingStatus.value = true
  errorMessage.value = ''
  try {
    const response = await updateProjectStatus(projectId, newStatus)
    if (response.success && response.data) {
      project.value.status = response.data.status
    }
  } catch (error) {
    console.error('更新狀態失敗:', error)
    errorMessage.value = '狀態更新失敗，請重試'
  } finally {
    isUpdatingStatus.value = false
  }
}

// 儲存文案
const saveCaption = async () => {
  if (isSavingCaption.value) return
  isSavingCaption.value = true
  errorMessage.value = ''
  try {
    const response = await updateProjectCaption(projectId, captionText.value)
    if (response.success && response.data) {
      project.value.caption = response.data.caption || ''
    } else {
      errorMessage.value = '文案保存失敗，請重試'
      console.error('保存文案失敗:', response.error)
    }
  } catch (error) {
    errorMessage.value = '文案保存失敗，請重試'
    console.error('保存文案出錯:', error)
  } finally {
    isSavingCaption.value = false
  }
}

// ===== 素材管理模式 =====
const toggleAssetManagement = () => {
  isAssetManagementMode.value = !isAssetManagementMode.value
}

const enterAssetManagement = () => {
  isAssetManagementMode.value = true
}

const exitAssetManagement = () => {
  isAssetManagementMode.value = false
}

const removeAssetDirectly = async (assetId) => {
  try {
    await removeAssetFromProject(projectId, assetId)
    await fetchProjectDetails()
    console.log('素材已移除:', assetId)
  } catch (error) {
    console.error('移除素材失敗:', error)
    errorMessage.value = '移除素材失敗，請重試'
  }
}

// 匯出選擇模式
const enterExportSelectMode = () => {
  isExportSelectMode.value = true
  selectedExportIds.value = [...project.value.selectedForExport]
}

const exitExportSelectMode = () => {
  isExportSelectMode.value = false
  selectedExportIds.value = []
}

const toggleExportSelect = (assetId) => {
  const idx = selectedExportIds.value.indexOf(assetId)
  if (idx >= 0) {
    selectedExportIds.value.splice(idx, 1)
  } else {
    selectedExportIds.value.push(assetId)
  }
}

const confirmExportSelection = async () => {
  try {
    // 儲存選擇的素材ID到專案中，用於後續匯出
    project.value.selectedForExport = [...selectedExportIds.value]
    
    // 呼叫 API 更新專案選擇的素材
    const response = await updateProjectAssets(projectId, selectedExportIds.value)
    if (response.success) {
      console.log('選擇用於匯出的素材已保存:', selectedExportIds.value)
    } else {
      console.error('更新素材選擇失敗:', response.error)
      errorMessage.value = '更新素材選擇失敗，請重試'
    }
  } catch (error) {
    console.error('更新素材選擇失敗:', error)
    errorMessage.value = '更新素材選擇失敗，請重試'
  } finally {
    exitExportSelectMode()
  }
}

// 匯入 Modal 操作
const openImportModal = () => {
  showImportModal.value = true
}

const closeImportModal = () => {
  showImportModal.value = false
}

const handleImport = async (importResult) => {
  await fetchProjectDetails()
}

// 開啟上傳素材 Modal
const openUploadAssetModal = () => {
  showUploadAssetModal.value = true
}

// 關閉上傳素材 Modal
const closeUploadAssetModal = () => {
  showUploadAssetModal.value = false
  isUploadingAssets.value = false
  uploadProgress.value = 0
  currentFileIndex.value = 0
  totalFiles.value = 0
}

// 處理上傳素材
const handleUploadAssets = async (files) => {
  if (!files || files.length === 0) return
  
  isUploadingAssets.value = true
  totalFiles.value = files.length
  uploadProgress.value = 0
  currentFileIndex.value = 0
  errorMessage.value = ''
  
  try {
    for (let index = 0; index < files.length; index++) {
      const file = files[index]
      currentFileIndex.value = index + 1
      uploadProgress.value = 0
      
      try {
        await uploadAssetToProject(projectId, file, (progress) => {
          uploadProgress.value = progress.percentage
        })
      } catch (error) {
        console.error(`第 ${index + 1} 個檔案上傳失敗:`, error)
        errorMessage.value = `第 ${index + 1} 個檔案上傳失敗: ${error.message}`
      }
    }
    
    // 上傳完成後刷新列表
    await fetchProjectDetails()
    
    // 延遲後關閉 Modal
    setTimeout(() => {
      isUploadingAssets.value = false
      uploadProgress.value = 0
      currentFileIndex.value = 0
      totalFiles.value = 0
      closeUploadAssetModal()
    }, 500)
  } catch (error) {
    console.error('上傳過程中發生錯誤:', error)
    errorMessage.value = '上傳過程中發生錯誤'
    isUploadingAssets.value = false
    uploadProgress.value = 0
    currentFileIndex.value = 0
    totalFiles.value = 0
  }
}

// ===== 標籤管理功能 =====
const allTags = ref([])
const globalTags = ref([])
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

const selectedProjectTags = computed(() => {
  return allTags.value
    .filter(tag => tag.isSelected)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
})

const selectedGlobalTags = computed(() => {
  return globalTags.value
    .filter(tag => tag.isSelected)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
})

const selectedTags = computed(() => {
  return [...selectedProjectTags.value, ...selectedGlobalTags.value]
})

// 載入專案標籤
const loadProjectTags = async () => {
  try {
    const response = await getProjectTags(projectId)
    if (response.success && response.data) {
      allTags.value = response.data.map(tag => ({
        id: tag.id,
        name: tag.name,
        isSelected: tag.is_selected,
        type: 'project',
        sortOrder: tag.sort_order || 0
      }))
    }
  } catch (error) {
    console.error('載入專案標籤失敗:', error)
  }
}

// 載入全域標籤
const loadGlobalTags = async () => {
  try {
    const response = await getTags()
    if (response.success && response.data) {
      globalTags.value = response.data.map(tag => ({
        id: tag.id,
        name: tag.name,
        isSelected: tag.is_selected,
        type: 'global',
        sortOrder: tag.sort_order || 0
      }))
    }
  } catch (error) {
    console.error('載入全域標籤失敗:', error)
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
  // 複製當前標籤狀態到本地管理
  localSelectedTags.value = allTags.value
    .filter(tag => tag.isSelected)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(tag => ({ ...tag }))
  localUnselectedTags.value = allTags.value
    .filter(tag => !tag.isSelected)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(tag => ({ ...tag }))
  newTagName.value = ''
}

const exitTagManagement = async () => {
  isTagManagementMode.value = false
  localSelectedTags.value = []
  localUnselectedTags.value = []
  newTagName.value = ''
  
  // 退出管理模式時，重新加載最新的標籤數據確保顯示最新信息
  await loadProjectTags()
  await loadGlobalTags()
}

const addNewTag = async () => {
  if (!newTagName.value.trim()) return
  
  try {
    const response = await AddProjectTag(projectId, newTagName.value.trim())
    
    if (response.success && response.data) {
      // 添加新標籤到已選擇列表（默認選中）
      const newTag = {
        id: response.data.id,
        name: response.data.name,
        isSelected: true,
        type: 'project',
        sortOrder: localSelectedTags.value.length
      }
      localSelectedTags.value.push(newTag)
      newTagName.value = ''
      
      // 新增完成後重新加載最新數據，確保管理功能和一般狀況都顯示最新信息
      await loadProjectTags()
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
    
    // 立即更新 API
    try {
      await updateProjectTagSelection(projectId, tag.id, true)
      // 更新本地 allTags
      const tagInAll = allTags.value.find(t => t.id === tag.id)
      if (tagInAll) {
        tagInAll.isSelected = true
      }
      // 更新完成後重新加載最新數據，確保管理功能和一般狀況都顯示最新信息
      await loadProjectTags()
      console.log('標籤選擇狀態已更新:', tag.name)
    } catch (error) {
      console.error('更新標籤選擇狀態失敗:', error)
      // 如果失敗，恢復狀態
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
    
    // 立即更新 API
    try {
      await updateProjectTagSelection(projectId, tag.id, false)
      // 更新本地 allTags
      const tagInAll = allTags.value.find(t => t.id === tag.id)
      if (tagInAll) {
        tagInAll.isSelected = false
      }
      // 更新完成後重新加載最新數據，確保管理功能和一般狀況都顯示最新信息
      await loadProjectTags()
      console.log('標籤選擇狀態已更新:', tag.name)
    } catch (error) {
      console.error('更新標籤選擇狀態失敗:', error)
      // 如果失敗，恢復狀態
      const idx = localUnselectedTags.value.findIndex(t => t.id === tag.id)
      if (idx >= 0) {
        localUnselectedTags.value.splice(idx, 1)
        localSelectedTags.value.push(tag)
      }
    }
  }
}

// 拖拽相關函數
const handleDragStart = (event, tag, from, index = null) => {
  draggedTag = tag
  draggedFrom = from
  draggedIndex = index
  draggedElement = event.target
  event.target.classList.add('dragging')
  
  // 標記容器為拖拽中
  if (from === 'selected' && selectedContainer.value) {
    selectedContainer.value.classList.add('drag-active')
  } else if (from === 'unselected' && unselectedContainer.value) {
    unselectedContainer.value.classList.add('drag-active')
  }
}

const handleDragEnd = (event) => {
  event.target.classList.remove('dragging')
  
  // 移除容器拖拽樣式
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
  
  // 確保目標是標籤項目
  const targetItem = event.target.closest('.tag-item')
  if (!targetItem || !targetItem.classList.contains('draggable')) return
  
  // 只在已選擇區域內允許排序
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

const handleDragOver = (event, section) => {
  event.preventDefault()
}

const handleDrop = async (event, section) => {
  event.preventDefault()
  
  if (!draggedTag) return
  
  // 如果拖到不同的區域
  if (draggedFrom !== section) {
    if (section === 'selected') {
      await moveTagToSelected(draggedTag)
    } else {
      await moveTagToUnselected(draggedTag)
    }
  } else if (section === 'selected') {
    // 如果在已選擇區域內拖拽，更新順序
    const container = selectedContainer.value
    const items = [...container.querySelectorAll('.tag-item.draggable')]
    const newOrder = items.map(item => {
      const tagId = item.getAttribute('data-tag-id')
      return localSelectedTags.value.find(t => t.id === tagId)
    }).filter(Boolean)
    
    localSelectedTags.value = newOrder
    
    // 立即更新排序到 API
    try {
      const selectedProjectTagIds = newOrder
        .filter(tag => tag.type === 'project')
        .map(tag => tag.id)
      
      const unselectedProjectTagIds = localUnselectedTags.value
        .filter(tag => tag.type === 'project')
        .map(tag => tag.id)
      
      const allProjectTagIds = [...selectedProjectTagIds, ...unselectedProjectTagIds]
      
      if (allProjectTagIds.length > 0) {
        await reorderProjectTags(projectId, allProjectTagIds)
        // 更新本地 allTags
        newOrder.forEach((tag, index) => {
          const tagInAll = allTags.value.find(t => t.id === tag.id)
          if (tagInAll) {
            tagInAll.sortOrder = index
          }
        })
        // 排序更新完成後重新加載最新數據，確保管理功能和一般狀況都顯示最新信息
        await loadProjectTags()
        console.log('標籤排序已更新')
      }
    } catch (error) {
      console.error('更新標籤排序失敗:', error)
    }
  }
}



const copyTags = async () => {
  const tagsContent = selectedTags.value.map(tag => `#${tag.name}`).join(' ')
  const tagString = `【${project.value.name}】 ${tagsContent}`
  const success = await copyToClipboard(tagString)
  if (success) {
    console.log('標籤已複製:', tagString)
    copyTagsSuccess.value = true
    setTimeout(() => {
      copyTagsSuccess.value = false
    }, 3000)
  } else {
    console.error('複製標籤失敗')
    // 可以選擇顯示錯誤提示，但這裡先不加
  }
}

// ===== 匯出影片功能 =====
const latestTask = ref(null)
const isExportManagementMode = ref(false)
const localResolutionWidth = ref(1080)
const localResolutionHeight = ref(1920)
const localVideoDuration = ref(10)
const localTotalDuration = ref(17)
const isSavingExportOptions = ref(false)
const exportErrorMessage = ref('')

const toggleExportManagement = () => {
  if (isExportManagementMode.value) {
    exitExportManagement()
  } else {
    enterExportManagement()
  }
}

const enterExportManagement = () => {
  // 解析當前的解析度
  const resolution = project.value.exportParams.resolution || '1080x1920'
  const [width, height] = resolution.split('x').map(Number)
  localResolutionWidth.value = width || 1080
  localResolutionHeight.value = height || 1920
  localVideoDuration.value = project.value.exportParams.videoDuration || 10
  localTotalDuration.value = project.value.exportParams.totalDuration || 17
  exportErrorMessage.value = ''
  isExportManagementMode.value = true
}

const exitExportManagement = () => {
  isExportManagementMode.value = false
  exportErrorMessage.value = ''
}

const saveExportOptions = async () => {
  if (localResolutionWidth.value < 1 || localResolutionHeight.value < 1) {
    exportErrorMessage.value = '解析度必須大於 0'
    return
  }
  if (localVideoDuration.value < 1 || localTotalDuration.value < 1) {
    exportErrorMessage.value = '影片長度和總長度必須大於 0'
    return
  }
  if (localTotalDuration.value <= localVideoDuration.value) {
    exportErrorMessage.value = '總長度必須大於影片長度'
    return
  }

  isSavingExportOptions.value = true
  exportErrorMessage.value = ''
  
  try {
    const resolution = `${localResolutionWidth.value}x${localResolutionHeight.value}`
    const response = await updateExportOptions(projectId, {
      resolution: resolution,
      video_duration: localVideoDuration.value,
      total_duration: localTotalDuration.value
    })
    
    if (response.success && response.data) {
      // 更新 project.exportParams
      project.value.exportParams = {
        resolution: resolution,
        videoDuration: localVideoDuration.value,
        totalDuration: localTotalDuration.value
      }
      console.log('匯出參數已保存')
      // 不自動關閉管理模式，讓用戶可以繼續調整
    } else {
      exportErrorMessage.value = '保存失敗，請重試'
      console.error('保存匯出參數失敗:', response.error)
    }
  } catch (error) {
    exportErrorMessage.value = '保存失敗，請重試'
    console.error('保存匯出參數出錯:', error)
  } finally {
    isSavingExportOptions.value = false
  }
}

const executeExport = async () => {
  if (isExportTaskRunning.value) {
    console.log('匯出任務正在執行中，請稍後再試。')
    return
  }

  try {
    const response = await createExportTask(projectId, {
      resolution: project.value.exportParams.resolution,
      videoDuration: project.value.exportParams.videoDuration,
      totalDuration: project.value.exportParams.totalDuration,
      assetIds: project.value.selectedForExport || []
    })

    if (response.success) {
      console.log('匯出任務已建立')
      isExportTaskRunning.value = true
      
      // 設置初始任務狀態，稍後會通過 checkExportTaskStatus 更新
      latestTask.value = {
        id: 'temp-' + Date.now(), // 臨時ID，稍後會被真實ID替換
        status: 'PROCESSING',
        created_at: new Date().toISOString()
      }
      
      checkExportTaskStatus()
    } else {
      console.error('建立匯出任務失敗:', response.error)
    }
  } catch (error) {
    console.error('建立匯出任務失敗:', error)
  }
}

// 計算下載檔案名稱
const downloadFileName = computed(() => {
  if (!latestTask.value) {
    return 'video.mp4'
  }
  const taskIdShort = latestTask.value.id.substring(0, 8)
  const projectName = project.value.name || 'video'
  return `${projectName}_${taskIdShort}.mp4`
})

const getStatusText = (status) => {
  const statusMap = {
    'PENDING': '匯出中...',
    'PROCESSING': '匯出中...',
    'SUCCESS': '匯出成功',
    'FAILED': '匯出失敗'
  }
  return statusMap[status] || status
}

const formatTime = (timeString) => {
  const date = new Date(timeString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}/${month}/${day} ${hours}:${minutes}`
}

// ===== 任務狀態管理 =====
const isCaptionTaskRunning = ref(false)
const isTagTaskRunning = ref(false)
const isDownloadTaskRunning = ref(false)
const isExportTaskRunning = ref(false)
const captionTaskId = ref(null)
const tagTaskId = ref(null)
const downloadTaskId = ref(null)
const exportTaskId = ref(null)
const taskPollingInterval = ref(null)

// ===== 自動功能 =====
const autoGenerateCaption = async () => {
  if (isCaptionTaskRunning.value) {
    console.log('文案任務正在執行中，請稍後再試。')
    return
  }

  try {
    const response = await createCaptionTask(projectId)

    if (response.success) {
      console.log('文案任務已建立')
      isCaptionTaskRunning.value = true
      checkCaptionTaskStatus()
    } else {
      console.error('建立文案任務失敗:', response.error)
    }
  } catch (error) {
    console.error('建立文案任務失敗:', error)
  }
}

const autoGenerateTags = async () => {
  if (isTagTaskRunning.value) {
    console.log('標籤任務正在執行中，請稍後再試。')
    return
  }

  try {
    const response = await createTagTask(projectId)

    if (response.success) {
      console.log('標籤任務已建立')
      isTagTaskRunning.value = true
      checkTagTaskStatus()
    } else {
      console.error('建立標籤任務失敗:', response.error)
    }
  } catch (error) {
    console.error('建立標籤任務失敗:', error)
  }
}

const autoSearchAssets = async () => {
  if (isDownloadTaskRunning.value) {
    console.log('下載任務正在執行中，請稍後再試。')
    return
  }

  try {
    const tags = selectedTags.value.map(tag => tag.name)
    const response = await createDownloadTask(projectId, tags)

    if (response.success) {
      console.log('下載任務已建立')
      isDownloadTaskRunning.value = true
      checkDownloadTaskStatus()
    } else {
      console.error('建立下載任務失敗:', response.error)
    }
  } catch (error) {
    console.error('建立下載任務失敗:', error)
  }
}

// ===== 任務狀態檢查 =====
const checkCaptionTaskStatus = async () => {
  try {
    const response = await getCaptionTasks(projectId)

    if (response.success && response.data) {
      const tasks = response.data
      const hasRunningTask = tasks.some(task =>
        task.status === 'PENDING' || task.status === 'PROCESSING'
      )

      const previousRunning = isCaptionTaskRunning.value
      isCaptionTaskRunning.value = hasRunningTask

      // 如果任務從執行中變為完成，重新載入專案資料
      if (previousRunning && !isCaptionTaskRunning.value) {
        console.log('文案任務已完成，重新載入專案資料')
        await fetchProjectDetails()
      }
    }
  } catch (error) {
    console.error('檢查文案任務狀態失敗:', error)
  }
}

const checkTagTaskStatus = async () => {
  try {
    const response = await getTagTasks(projectId)

    if (response.success && response.data) {
      const tasks = response.data
      const hasRunningTask = tasks.some(task =>
        task.status === 'PENDING' || task.status === 'PROCESSING'
      )

      const previousRunning = isTagTaskRunning.value
      isTagTaskRunning.value = hasRunningTask

      // 如枟任務從執行中變為完成，重新載入標籤資料
      if (previousRunning && !isTagTaskRunning.value) {
        console.log('標籤任務已完成，重新載入標籤資料')
        await loadProjectTags()
      }
    }
  } catch (error) {
    console.error('檢查標籤任務狀態失敗:', error)
  }
}

const checkDownloadTaskStatus = async () => {
  try {
    const response = await getDownloadTasks(projectId)

    if (response.success && response.data) {
      const tasks = response.data
      const hasRunningTask = tasks.some(task =>
        task.status === 'PENDING' || task.status === 'PROCESSING'
      )

      const previousRunning = isDownloadTaskRunning.value
      isDownloadTaskRunning.value = hasRunningTask

      // 如果任務從執行中變為完成，重新載入專案資料
      if (previousRunning && !isDownloadTaskRunning.value) {
        console.log('下載任務已完成，重新載入專案資料')
        await fetchProjectDetails()
      }
    }
  } catch (error) {
    console.error('檢查下載任務狀態失敗:', error)
  }
}

const checkExportTaskStatus = async () => {
  try {
    const response = await getExportTasks(projectId)

    if (response.success && response.data) {
      const tasks = response.data
      
      // 使用最新的那筆匯出任務（不管狀態如何）
      if (tasks.length > 0) {
        const latestExportTask = tasks[0] // 假設第一個是最新的
        latestTask.value = {
          id: latestExportTask.id,
          status: latestExportTask.status,
          created_at: latestExportTask.created_at
        }
      } else {
        latestTask.value = null
      }
      
      const hasRunningTask = tasks.some(task =>
        task.status === 'PENDING' || task.status === 'PROCESSING'
      )

      const previousRunning = isExportTaskRunning.value
      isExportTaskRunning.value = hasRunningTask

      // 如果任務從執行中變為完成，重新載入專案資料
      if (previousRunning && !isExportTaskRunning.value) {
        console.log('匯出任務已完成，重新載入專案資料')
        await fetchProjectDetails()
      }
    }
  } catch (error) {
    console.error('檢查匯出任務狀態失敗:', error)
  }
}

// ===== 定時檢查任務狀態 =====
const startTaskPolling = () => {
  // 每5秒檢查一次任務狀態
  taskPollingInterval.value = setInterval(() => {
    if (isCaptionTaskRunning.value) checkCaptionTaskStatus()
    if (isTagTaskRunning.value) checkTagTaskStatus()
    if (isDownloadTaskRunning.value) checkDownloadTaskStatus()
    if (isExportTaskRunning.value) checkExportTaskStatus()
  }, 5000)
}

const stopTaskPolling = () => {
  if (taskPollingInterval.value) {
    clearInterval(taskPollingInterval.value)
    taskPollingInterval.value = null
  }
}

// 分享影片
const shareVideo = async () => {
  if (!project.value.exportUrl) return

  // 檢查是否支援 Web Share API
  if (!navigator.share) {
    // 不支援分享，直接下載
    const a = document.createElement('a')
    a.href = project.value.exportUrl
    a.download = downloadFileName.value
    a.click()
    return
  }

  try {
    // 先嘗試下載影片並轉成 File 物件
    const response = await fetch(project.value.exportUrl)
    const blob = await response.blob()
    const file = new File([blob], downloadFileName.value, { type: 'video/mp4' })

    // 檢查是否支援檔案分享
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      // 支援檔案分享，直接分享檔案
      await navigator.share({
        files: [file],
        title: project.value.name || '影片',
        text: project.value.caption || ''
      })
    } else {
      // 不支援檔案分享，分享連結
      await navigator.share({
        title: project.value.name || '影片',
        text: project.value.caption || '',
        url: project.value.exportUrl
      })
    }
  } catch (error) {
    // 使用者取消分享不算錯誤
    if (error.name !== 'AbortError') {
      console.error('分享失敗:', error)
      // 如果分享失敗，fallback 到下載
      const a = document.createElement('a')
      a.href = project.value.exportUrl
      a.download = downloadFileName.value
      a.click()
    }
  }
}

// 在組件卸載時停止任務輪詢
onBeforeUnmount(() => {
  stopTaskPolling()
})

// 在組件掛載時啟動任務輪詢
onMounted(async () => {
  await fetchProjectDetails()
  await loadProjectTags()
  await loadGlobalTags()
  await checkCaptionTaskStatus() // 檢查文案任務狀態
  await checkTagTaskStatus() // 檢查標籤任務狀態
  await checkDownloadTaskStatus() // 檢查下載任務狀態
  await checkExportTaskStatus() // 檢查匯出任務狀態
  startTaskPolling()
})
</script>

<style scoped>
/* 頁面標頭 */
.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.page-title-section {
  flex: 1;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.btn-back {
  padding: 6px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
}

.back-icon {
  width: 18px;
  height: 18px;
  display: block;
}

.btn-back:hover {
  color: var(--shopee-primary);
}

/* 模組卡片 */
.module-card {
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-primary);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 8px;
}

.card-header {
  margin-bottom: 14px;
}

.card-header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
}

.selection-stats {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
  margin-left: auto;
}

.card-header-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.card-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  flex-shrink: 0;
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

.icon-btn svg {
  width: 18px;
  height: 18px;
  display: block;
}

.icon-img {
  width: 18px;
  height: 18px;
  display: block;
}

/* 狀態按鈕 */
.status-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.status-btn {
  padding: 10px 16px;
  border: 2px solid var(--border-primary);
  background: var(--bg-card);
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  transition: all 0.2s;
  white-space: nowrap;
}

.status-btn:hover {
  border-color: var(--shopee-primary);
  background: var(--shopee-primary-light);
}

.status-btn.active {
  border-color: var(--shopee-primary);
  background: var(--shopee-primary);
  color: white;
}

.status-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 專案名稱輸入框 */
.project-name-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 500;
  font-family: inherit;
  transition: border-color 0.2s;
}

.project-name-input:focus {
  outline: none;
  border-color: var(--shopee-primary);
  box-shadow: 0 0 0 3px rgba(238, 77, 45, 0.1);
}

.project-name-input::placeholder {
  color: var(--text-secondary);
}

/* 文案區域 */
.caption-textarea {
  width: 100%;
  min-height: 100px;
  padding: 12px;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s;
}

.caption-textarea:focus {
  outline: none;
  border-color: var(--shopee-primary);
  box-shadow: 0 0 0 3px rgba(238, 77, 45, 0.1);
}

/* 專案管理區塊 */
.project-management-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.project-caption-display {
  padding: 16px;
  background: var(--bg-section);
  border-radius: 8px;
  min-height: 80px;
}

.caption-content {
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.empty-caption {
  color: var(--text-secondary);
  font-size: 14px;
  font-style: italic;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--shopee-primary);
  box-shadow: 0 0 0 3px rgba(238, 77, 45, 0.1);
}

.form-textarea {
  width: 100%;
  min-height: 100px;
  padding: 12px;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--shopee-primary);
  box-shadow: 0 0 0 3px rgba(238, 77, 45, 0.1);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 素材 Grid */
.assets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}

.asset-card {
  background: var(--bg-card);
  border-radius: 12px;
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition: all 0.2s;
}

.asset-card:hover {
  border-color: var(--shopee-primary);
}

.asset-preview {
  width: 100%;
  aspect-ratio: 1;
  background: var(--bg-section);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.preview-placeholder {
  font-size: 64px;
  opacity: 0.3;
}

.thumbnail-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.badge {
  position: absolute;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
}

.image-badge {
  top: 10px;
  right: 10px;
  background: var(--shopee-success);
}

.video-badge {
  top: 10px;
  right: 10px;
  background: var(--shopee-primary);
}

/* 動作按鈕行 */
.actions-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.asset-card.remove-mode {
  opacity: 0.9;
  cursor: pointer;
}

.asset-card.export-select-mode {
  opacity: 0.9;
  cursor: pointer;
}

.asset-card.remove-mode {
  border-color: transparent;
  opacity: 1;
}

.remove-btn {
  position: absolute;
  bottom: 8px;
  left: 8px;
  padding: 6px 10px;
  background: rgba(255, 68, 68, 0.9);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 10;
}

.remove-btn:hover {
  background: rgba(255, 68, 68, 1);
  transform: scale(1.05);
}

.asset-card.selected {
  border-color: var(--shopee-primary);
  background: var(--shopee-primary-light);
  box-shadow: 0 0 0 2px rgba(238, 77, 45, 0.2);
}

.asset-card.selected-for-export {
  border-color: var(--shopee-primary);
  border-width: 2px;
  background: var(--shopee-primary-light);
  box-shadow: 0 0 0 2px rgba(238, 77, 45, 0.2);
}

/* 匯入 Modal */
.modal-wide {
  max-width: 700px;
}

.import-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  max-height: 50vh;
  overflow-y: auto;
  margin-bottom: 16px;
}

.import-card {
  cursor: pointer;
}

.import-card.selected {
  border-color: var(--shopee-primary);
  background: var(--shopee-primary-light);
  box-shadow: 0 0 0 2px rgba(238, 77, 45, 0.2);
}

.select-indicator {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 24px;
  height: 24px;
  background: var(--shopee-primary);
  color: white;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
}

.selection-info {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
  margin-right: auto;
}

.modal-empty {
  padding: 40px 20px;
}

/* 按鈕 disabled */
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary.success {
  background: transparent;
  color: var(--shopee-success);
  border-color: var(--shopee-success);
}

.asset-management-btn {
  transition: opacity 0.2s ease;
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
  color: white;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 500;
}

.tag-chip-project {
  background: var(--shopee-primary);
}

.tag-chip-global {
  background: var(--shopee-info);
}

/* 標籤管理容器 */
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

.tags-container.tags-static {
  background: var(--bg-section);
  border-style: dashed;
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

/* ===== 匯出影片樣式 ===== */
.export-status-info {
  font-size: 14px;
  color: var(--text-secondary);
  margin-left: auto;
}

.export-management-container {
  background: var(--bg-page);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--border-primary);
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--shopee-primary);
  box-shadow: 0 0 0 3px rgba(238, 77, 45, 0.1);
}

.resolution-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.resolution-inputs input {
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

.resolution-inputs input:focus {
  outline: none;
  border-color: var(--shopee-primary);
  box-shadow: 0 0 0 3px rgba(238, 77, 45, 0.1);
}

.resolution-inputs span {
  color: var(--text-secondary);
  font-weight: 600;
}

.form-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.form-error {
  padding: 10px 12px;
  background: rgba(255, 68, 68, 0.1);
  border: 1px solid rgba(255, 68, 68, 0.3);
  border-radius: 8px;
  color: #ff4444;
  font-size: 13px;
  margin-bottom: 16px;
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}

.btn-download {
  padding: 10px 20px;
  background: var(--shopee-success);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-download:hover {
  background: #218838;
  transform: translateY(-1px);
  box-shadow: var(--shadow-hover);
}

@media (max-width: 768px) {
  .module-card {
    padding: 12px;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .page-header {
    gap: 12px;
  }

  .page-title {
    font-size: 20px;
  }

  .card-header-inline {
    margin-bottom: 8px;
  }

  .card-title {
    font-size: 16px;
    margin: 0;
  }

  .icon-btn {
    padding: 5px;
  }

  .icon-btn .icon {
    width: 16px;
    height: 16px;
  }

  .card-header-top {
    flex-direction: row;
    align-items: center;
  }

  .selection-stats {
    margin-left: auto;
    margin-top: 0;
    font-size: 13px;
  }

  .status-buttons {
    gap: 6px;
  }

  .status-btn {
    flex: 1;
    padding: 8px 8px;
    font-size: 13px;
  }

  .card-header .btn-primary {
    width: 100%;
    padding: 8px 12px;
    font-size: 13px;
  }

  .actions-row {
    flex-direction: row !important;
    flex-wrap: wrap;
    gap: 8px;
  }

  .actions-row button,
  .actions-row a {
    width: auto !important;
    flex: 1;
    min-width: 0;
    padding: 8px 12px;
    font-size: 14px;
    text-align: center;
  }

  .assets-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .preview-placeholder {
    font-size: 48px;
  }

  .import-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .modal-wide {
    max-width: 100%;
  }

  .export-status-info {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .export-management-container {
    padding: 12px;
  }

  .form-group {
    margin-bottom: 12px;
  }

  .form-label {
    font-size: 13px;
  }

  .form-hint {
    font-size: 11px;
  }

  .resolution-inputs {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .resolution-inputs input {
    flex: 1;
    min-width: 0;
  }

  .resolution-inputs span {
    font-size: 16px;
    font-weight: bold;
    color: var(--text-secondary);
    flex-shrink: 0;
  }
}
</style>
