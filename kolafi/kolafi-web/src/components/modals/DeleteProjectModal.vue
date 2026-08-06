<template>
  <div v-if="show" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title">刪除專案</h2>
        <button class="modal-close" @click="closeModal">✕</button>
      </div>

      <div class="modal-body">
        <div class="warning-icon">🗑️</div>
        <p class="warning-text">
          確定要刪除專案「<strong>{{ projectName }}</strong>」嗎？
        </p>
        <p class="warning-sub">此操作無法復原，專案的所有素材、任務與匯出紀錄將一併刪除。</p>
      </div>

      <div class="modal-footer">
        <button
          type="button"
          class="btn-secondary"
          @click="closeModal"
          :disabled="isLoading"
        >
          取消
        </button>
        <button
          type="button"
          class="btn-danger"
          @click="confirmDelete"
          :disabled="isLoading"
        >
          {{ isLoading ? '刪除中...' : '確認刪除' }}
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
  projectName: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'confirm'])

const isLoading = ref(false)

const closeModal = () => {
  if (!isLoading.value) {
    emit('close')
  }
}

const confirmDelete = async () => {
  isLoading.value = true
  try {
    await emit('confirm')
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-card);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 400px;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 0;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 16px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.modal-close:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
  text-align: center;
}

.warning-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.warning-text {
  font-size: 15px;
  color: var(--text-primary);
  margin: 0 0 8px;
  line-height: 1.5;
}

.warning-sub {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.modal-footer {
  display: flex;
  gap: 8px;
  padding: 0 20px 20px;
  justify-content: flex-end;
}

.btn-secondary {
  padding: 8px 20px;
  border-radius: 8px;
  border: 1px solid var(--border-primary);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.btn-secondary:hover:not(:disabled) {
  border-color: var(--shopee-primary);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-danger {
  padding: 8px 20px;
  border-radius: 8px;
  border: none;
  background: #ee4444;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-danger:hover:not(:disabled) {
  opacity: 0.85;
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
