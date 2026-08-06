<template>
  <div v-if="show" class="modal" @click="$emit('close')">
    <div class="modal-content modal-wide" @click.stop>
      <div class="modal-header">匯入素材到專案</div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>載入中...</p>
      </div>

      <div v-else-if="availableAssets.length === 0" class="empty-state modal-empty">
        <div class="empty-icon">📁</div>
        <p>沒有可匯入的素材</p>
      </div>

      <div v-else class="import-grid">
        <div
          v-for="asset in availableAssets"
          :key="asset.id"
          class="asset-card import-card"
          :class="{ selected: localSelectedIds.includes(asset.id) }"
          @click="toggleSelect(asset.id)"
        >
          <div class="asset-preview">
            <img v-if="asset.thumbnailPath" :src="asset.thumbnailPath" :alt="asset.id" class="thumbnail-image">
            <div v-else class="preview-placeholder">{{ asset.type === 'image' ? '🖼️' : '🎬' }}</div>
            <span class="badge" :class="`${asset.type}-badge`">
              {{ asset.type === 'image' ? '圖片' : '影片' }}
            </span>
            <span v-if="localSelectedIds.includes(asset.id)" class="select-indicator">✓</span>
          </div>
        </div>
      </div>

      <div class="modal-actions">
        <span class="selection-info">已選擇 {{ localSelectedIds.length }} 個素材</span>
        <button class="btn-secondary" @click="$emit('close')">取消</button>
        <button
          class="btn-primary"
          :disabled="localSelectedIds.length === 0 || isImporting"
          @click="confirmImport"
        >
          {{ isImporting ? '匯入中...' : `匯入 (${localSelectedIds.length})` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { getUnusedAssets } from '../../services/assetService'
import { ImportAssetsToProject } from '../../services/projectAssetService'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  projectId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close', 'imported'])

const availableAssets = ref([])
const localSelectedIds = ref([])
const isLoading = ref(false)
const isImporting = ref(false)

watch(() => props.show, async (newVal) => {
  if (newVal) {
    localSelectedIds.value = []
    await fetchAvailableAssets()
  }
})

const fetchAvailableAssets = async () => {
  isLoading.value = true
  try {
    const response = await getUnusedAssets()
    if (response.success && Array.isArray(response.data)) {
      availableAssets.value = response.data.map(asset => ({
        id: asset.id,
        extension: asset.extension,
        type: asset.type.toLowerCase(),
        thumbnailPath: asset.thumbnail_path,
        originalPath: asset.original_path
      }))
    }
  } catch (error) {
    console.error('獲取可用素材失敗:', error)
  } finally {
    isLoading.value = false
  }
}

const toggleSelect = (assetId) => {
  const idx = localSelectedIds.value.indexOf(assetId)
  if (idx >= 0) {
    localSelectedIds.value.splice(idx, 1)
  } else {
    localSelectedIds.value.push(assetId)
  }
}

const confirmImport = async () => {
  if (localSelectedIds.value.length === 0 || isImporting.value) return
  
  isImporting.value = true
  try {
    const response = await ImportAssetsToProject(props.projectId, localSelectedIds.value)
    
    if (response.success) {
      emit('imported', response.data)
      emit('close')
    }
  } catch (error) {
    console.error('匯入素材失敗:', error)
  } finally {
    isImporting.value = false
  }
}
</script>

<style scoped>
.modal-wide {
  max-width: 800px;
}

.modal-empty {
  padding: 40px 0;
}

.import-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  max-height: 500px;
  overflow-y: auto;
  margin-bottom: 20px;
  padding: 4px;
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

.asset-card.selected {
  border-color: var(--shopee-primary);
  background: var(--shopee-primary-light);
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
  top: 10px;
  right: 10px;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
}

.image-badge {
  background: var(--shopee-success);
}

.video-badge {
  background: var(--shopee-primary);
}

.select-indicator {
  position: absolute;
  top: 10px;
  left: 10px;
  background: var(--shopee-primary);
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.selection-info {
  color: var(--text-secondary);
  font-size: 14px;
}

.modal-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
}

.loading-state {
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

@media (max-width: 768px) {
  .import-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    max-height: 400px;
  }
  
  .preview-placeholder {
    font-size: 48px;
  }
}
</style>
