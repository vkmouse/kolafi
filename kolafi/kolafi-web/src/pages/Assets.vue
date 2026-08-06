<template>
  <div class="page-container">
    <header class="page-header">
      <div class="header-top">
        <h1 class="page-title">素材庫</h1>
        <div class="header-actions">
          <UserAvatar />
        </div>
      </div>
      
      <div class="tab-bar">
        <button 
          v-for="filter in filters" 
          :key="filter.type"
          class="tab-btn"
          :class="{ active: currentFilter === filter.type }"
          @click="changeFilter(filter.type)"
        >
          {{ filter.label }}({{ filter.count }})
        </button>
      </div>
    </header>

    <div class="content-section">
      <div v-if="isLoadingAssets" class="loading-state">
        <div class="spinner"></div>
        <p>載入中...</p>
      </div>

      <div v-else-if="errorMessage" class="error-state">
        <div class="error-icon">⚠️</div>
        <p>{{ errorMessage }}</p>
        <button class="btn-secondary" @click="fetchAssets">重試</button>
      </div>

      <div v-else class="assets-grid">
        <div 
          v-for="asset in filteredAssets" 
          :key="asset.id"
          class="asset-card"
          @click="openPreview(asset)"
        >
          <div class="asset-preview">
            <img v-if="asset.thumbnailPath" :src="asset.thumbnailPath" :alt="asset.id" class="thumbnail-image">
            <div v-else class="preview-placeholder">
              {{ asset.type === 'image' ? '🖼️' : '🎬' }}
            </div>
            <!-- 類型徽章 -->
            <span class="badge" :class="`${asset.type}-badge`">
              {{ asset.type === 'image' ? '圖片' : '影片' }}
            </span>
            <!-- 未使用徽章 -->
            <span v-if="!asset.isUsed" class="badge usage-badge">
              未使用
            </span>
          </div>
        </div>
      </div>

      <div v-if="!isLoadingAssets && !errorMessage && filteredAssets.length === 0" class="empty-state">
        <div class="empty-icon">📦</div>
        <p>目前沒有{{ currentFilter === 'all' ? '' : filterLabels[currentFilter] }}素材</p>
      </div>

      <!-- Infinite Scroll 加載更多觸發器 -->
      <div v-if="!isLoadingAssets && !errorMessage && filteredAssets.length > 0" class="load-more-trigger"></div>
      
      <!-- 加載更多提示 -->
      <div v-if="isLoadingMore" class="loading-more">
        <div class="spinner-small"></div>
        <p>加載中...</p>
      </div>
      
      <!-- 沒有更多資料提示 -->
      <div v-if="!isLoadingAssets && !isLoadingMore && !hasMore && filteredAssets.length > 0" class="no-more">
        <p>沒有更多素材了</p>
      </div>
    </div>

    <!-- 上傳 Modal -->
    <UploadAssetModal 
      :show="showUploadModal" 
      @close="closeUploadModal"
      :onUpload="handleFileUpload"
      :isUploading="isUploading"
      :uploadProgress="uploadProgress"
      :currentFileIndex="currentFileIndex"
      :totalFiles="totalFiles"
    />

    <!-- 預覽 Modal -->
    <PreviewModal 
      :asset="previewAsset" 
      @close="closePreview"
    />

    <!-- 懸浮上傳按鈕 -->
    <button class="fab-btn" @click="openUploadModal" title="上傳素材">
      <span class="fab-icon">+</span>
      <span class="fab-text">上傳素材</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UploadAssetModal from '../components/modals/UploadAssetModal.vue'
import PreviewModal from '../components/modals/PreviewModal.vue'
import { getAssets, getAssetsStats, uploadAsset } from '../services/assetService'
import UserAvatar from '../components/UserAvatar.vue'

const route = useRoute()
const router = useRouter()

const filterLabels = {
  'all': '全部',
  'unused': '未使用',
  'image': '圖片',
  'video': '影片'
}

const assets = ref([])
const isLoadingAssets = ref(false)
const errorMessage = ref('')

// Infinite Scroll 相關狀態
const currentPage = ref(1)
const pageSize = 50
const hasMore = ref(true)
const isLoadingMore = ref(false)
const loadMoreObserver = ref(null)

// 素材統計數據
const assetStats = ref({
  total: 0,
  unused: 0,
  image: 0,
  video: 0
})

// 上傳相關狀態
const isUploading = ref(false)
const uploadProgress = ref(0)
const currentFileIndex = ref(0)
const totalFiles = ref(0)
const currentFilter = ref('all')

onMounted(async () => {
  const filter = route.query.filter
  if (filter && ['all', 'unused', 'image', 'video'].includes(filter)) {
    currentFilter.value = filter
  }
  await Promise.all([fetchAssets(), fetchStats()])
  
  // 設置 Infinite Scroll
  setupInfiniteScroll()
})

onUnmounted(() => {
  // 清理 observer
  if (loadMoreObserver.value) {
    loadMoreObserver.value.disconnect()
  }
})

const fetchStats = async () => {
  try {
    const response = await getAssetsStats()
    if (response.success && response.data) {
      assetStats.value = {
        total: response.data.total || 0,
        unused: response.data.unused || 0,
        image: response.data.image || 0,
        video: response.data.video || 0
      }
    }
  } catch (error) {
    console.error('取得素材統計失敗:', error)
  }
}

const fetchAssets = async (isLoadMore = false) => {
  if (isLoadMore) {
    isLoadingMore.value = true
  } else {
    isLoadingAssets.value = true
  }
  errorMessage.value = ''
  
  try {
    // 根據 filter 和分頁參數調用 API
    const response = await getAssets(currentFilter.value, currentPage.value, pageSize)
    
    if (response.success && Array.isArray(response.data)) {
      const processedAssets = response.data.map(asset => ({
        id: asset.id,
        extension: asset.extension,
        type: asset.type.toLowerCase(),
        sourceType: asset.source_type,
        sourceId: asset.source_id,
        createdAt: asset.created_at,
        originalPath: asset.original_path,
        thumbnailPath: asset.thumbnail_path,
        isUsed: asset.is_used || false
      }))

      if (isLoadMore) {
        // 加載更多：附加到現有資料
        assets.value = [...assets.value, ...processedAssets]
      } else {
        // 初始加載或篩選切換：替換資料
        assets.value = processedAssets
      }
      
      // 更新 hasMore 狀態
      hasMore.value = response.has_more || false
    }
  } catch (error) {
    console.error('取得素材失敗:', error)
    errorMessage.value = '無法載入素材清單，請重試'
  } finally {
    isLoadingAssets.value = false
    isLoadingMore.value = false
  }
}

// 計算篩選選項（使用統計數據）
const filters = computed(() => [
  { 
    type: 'all', 
    label: '全部', 
    count: assetStats.value.total
  },
  { 
    type: 'unused', 
    label: '未使用', 
    count: assetStats.value.unused
  },
  { 
    type: 'image', 
    label: '圖片', 
    count: assetStats.value.image
  },
  { 
    type: 'video', 
    label: '影片', 
    count: assetStats.value.video
  },
])

// 篩選後的素材（後端已過濾，直接返回）
const filteredAssets = computed(() => assets.value)

// 切換篩選
const changeFilter = async (type) => {
  if (currentFilter.value === type) return
  currentFilter.value = type
  currentPage.value = 1 // 重置頁碼
  hasMore.value = true // 重置 hasMore
  router.replace({ query: { filter: type } })
  await fetchAssets()
  
  // 切換篩選後重新設置 Infinite Scroll
  await nextTick()
  reconnectObserver()
}

// 設置 Infinite Scroll
const setupInfiniteScroll = () => {
  const options = {
    root: null,
    rootMargin: '200px',
    threshold: 0.1
  }

  loadMoreObserver.value = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && hasMore.value && !isLoadingMore.value && !isLoadingAssets.value) {
        loadMoreAssets()
      }
    })
  }, options)

  reconnectObserver()
}

// 重新連接 Observer 到目標元素
const reconnectObserver = () => {
  if (!loadMoreObserver.value) return
  
  // 先斷開所有現有的觀察
  loadMoreObserver.value.disconnect()
  
  // 重新觀察目標元素
  const target = document.querySelector('.load-more-trigger')
  if (target) {
    loadMoreObserver.value.observe(target)
  }
}

// 加載更多素材
const loadMoreAssets = async () => {
  if (!hasMore.value || isLoadingMore.value) return
  
  currentPage.value += 1
  await fetchAssets(true)
}

// Modal 相關
const showUploadModal = ref(false)

const openUploadModal = () => {
  showUploadModal.value = true
}

const closeUploadModal = () => {
  showUploadModal.value = false
}

const handleFileUpload = async (files) => {
  if (!files || files.length === 0) return
  
  isUploading.value = true
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
        await uploadAsset(file, (progress) => {
          uploadProgress.value = progress.percentage
        })
      } catch (error) {
        console.error(`第 ${index + 1} 個文件上傳失敗:`, error)
        errorMessage.value = `第 ${index + 1} 個文件上傳失敗: ${error.message}`
      }
    }
    
    // 上傳完成後刷新列表和統計
    await Promise.all([fetchAssets(), fetchStats()])
    
    // 延遲後關閉 Modal
    setTimeout(() => {
      isUploading.value = false
      uploadProgress.value = 0
      currentFileIndex.value = 0
      totalFiles.value = 0
      closeUploadModal()
    }, 500)
  } catch (error) {
    console.error('上傳過程中發生錯誤:', error)
    errorMessage.value = '上傳過程中發生錯誤'
    isUploading.value = false
    uploadProgress.value = 0
    currentFileIndex.value = 0
    totalFiles.value = 0
  }
}

// 預覽相關
const previewAsset = ref(null)

const openPreview = (asset) => {
  previewAsset.value = asset
}

const closePreview = () => {
  previewAsset.value = null
}
</script>

<style scoped>
/* 頁面內容區域 */
.content-section {
  padding: 0 16px;
}

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
  cursor: pointer;
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

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-primary);
  border-top-color: var(--shopee-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-state p,
.loading-state p {
  color: var(--text-secondary);
  margin-bottom: 16px;
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

.usage-badge {
  top: 10px;
  left: 10px;
  background: var(--shopee-info);
}

.load-more-trigger {
  height: 1px;
  width: 100%;
}

.loading-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
  text-align: center;
}

.spinner-small {
  width: 30px;
  height: 30px;
  border: 3px solid var(--border-primary);
  border-top-color: var(--shopee-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

.loading-more p {
  color: var(--text-secondary);
  font-size: 14px;
}

.no-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
  text-align: center;
}

.no-more p {
  color: var(--text-secondary);
  font-size: 14px;
}

/* 懸浮按鈕樣式 */
.fab-btn {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 50px;
  background-color: var(--shopee-primary);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fab-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.fab-icon {
  font-size: 20px;
  line-height: 1;
}

@media (max-width: 768px) {
  .content-section {
    padding: 0 1px;
  }
  
  .assets-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  
  .asset-card {
    border-radius: 8px;
  }
  
  .preview-placeholder {
    font-size: 48px;
  }

  .fab-btn {
    bottom: 100px; /* 避開底部導覽列 */
    right: 16px;
    width: 36px;
    height: 36px;
    padding: 0;
    justify-content: center;
    border-radius: 50%;
  }

  .fab-text {
    display: none;
  }

  .fab-icon {
    font-size: 24px;
  }
}
</style>
