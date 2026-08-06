<template>
  <div v-if="show" class="modal" @click="isUploading ? null : $emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">上傳素材</div>
      
      <div v-if="!isUploading" class="upload-area" @click="triggerFileInput">
        <div class="upload-icon">📤</div>
        <div class="upload-text">點擊或拖曳檔案到此處上傳</div>
        <div class="upload-hint">支援圖片（JPG, PNG）和影片（MP4, MOV）</div>
        <input 
          ref="fileInput" 
          type="file" 
          class="file-input" 
          multiple
          accept="image/*,video/*"
          @change="handleFileChange"
        />
      </div>

      <div v-if="isUploading" class="uploading-section">
        <div class="uploading-info">
          <div class="uploading-text">正在上傳...</div>
          <div class="uploading-stats">
            <div class="current-file">
              <span class="label">檔案</span>
              <span class="value">{{ currentFileIndex }} / {{ totalFiles }}</span>
            </div>
            <div class="percentage">
              <span class="value">{{ Math.round(uploadProgress) }}%</span>
            </div>
          </div>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar" :style="{ width: Math.round(uploadProgress) + '%' }"></div>
        </div>
      </div>
      
      <div class="modal-actions">
        <button 
          type="button" 
          class="btn-secondary" 
          @click="$emit('close')"
          :disabled="isUploading"
        >
          {{ isUploading ? '上傳中...' : '關閉' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  onUpload: {
    type: Function,
    required: false,
    default: null
  },
  isUploading: {
    type: Boolean,
    default: false
  },
  uploadProgress: {
    type: Number,
    default: 0
  },
  currentFileIndex: {
    type: Number,
    default: 0
  },
  totalFiles: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['close'])

const fileInput = ref(null)

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileChange = async (event) => {
  const files = event.target.files
  if (files && files.length > 0) {
    if (props.onUpload) {
      await props.onUpload(Array.from(files))
    }
    // 重置 input，允許再次選擇相同檔案
    event.target.value = ''
  }
}
</script>

<style scoped>
.upload-area {
  border: 2px dashed var(--border-dark);
  border-radius: 12px;
  padding: 48px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 20px;
  background: var(--bg-section);
}

.upload-area:hover {
  border-color: var(--shopee-primary);
  background: var(--shopee-primary-light);
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 15px;
  opacity: 0.5;
}

.upload-text {
  color: var(--text-primary);
  margin-bottom: 10px;
  font-weight: 500;
}

.upload-hint {
  font-size: 12px;
  color: var(--text-secondary);
}

.file-input {
  display: none;
}

.uploading-section {
  padding: 40px 20px;
  margin-bottom: 20px;
}

.uploading-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
  gap: 20px;
}

.uploading-text {
  color: var(--text-primary);
  font-weight: 500;
}

.uploading-stats {
  display: flex;
  gap: 20px;
  justify-content: flex-end;
}

.current-file {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.current-file .label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.current-file .value {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 14px;
}

.percentage {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.percentage .value {
  color: var(--shopee-primary);
  font-weight: 700;
  font-size: 18px;
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background: var(--bg-section);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--shopee-primary), var(--shopee-primary-light));
  transition: width 0.3s ease;
  border-radius: 4px;
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .upload-area {
    padding: 32px 16px;
  }
  
  .upload-icon {
    font-size: 40px;
  }
  
  .upload-text {
    font-size: 14px;
  }

  .uploading-section {
    padding: 30px 16px;
  }
}
</style>
