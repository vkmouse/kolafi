<template>
  <div v-if="show" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title">建立新專案</h2>
        <button class="modal-close" @click="closeModal">✕</button>
      </div>

      <form @submit.prevent="submitCreate" class="form-container">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">專案名稱</label>
            <input
              v-model="projectName"
              type="text"
              class="form-input"
              placeholder="請輸入專案名稱"
              :disabled="isLoading"
              @keyup.enter="submitCreate"
              autofocus
            />
          </div>
          <div v-if="errorMessage" class="form-error">
            {{ errorMessage }}
          </div>
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
            type="submit"
            class="btn-primary"
            :disabled="isLoading || !projectName.trim()"
          >
            {{ isLoading ? '建立中...' : '建立' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'create'])

const projectName = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

watch(() => props.show, (newVal) => {
  if (newVal) {
    projectName.value = ''
    errorMessage.value = ''
  }
})

const closeModal = () => {
  errorMessage.value = ''
  emit('close')
}

const submitCreate = async () => {
  const trimmedName = projectName.value.trim()

  if (!trimmedName) {
    errorMessage.value = '專案名稱不能為空'
    return
  }

  isLoading.value = true
  try {
    emit('create', trimmedName)
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
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-primary);
}

.modal-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.modal-close:hover {
  background: var(--bg-section);
  color: var(--text-primary);
}

.form-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: var(--shopee-primary);
  box-shadow: 0 0 0 3px rgba(238, 77, 45, 0.1);
}

.form-input:disabled {
  background: var(--bg-section);
  color: var(--text-secondary);
  cursor: not-allowed;
}

.form-error {
  color: var(--shopee-danger);
  font-size: 13px;
  padding: 8px 0;
  margin-top: 8px;
  text-align: left;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid var(--border-primary);
  justify-content: flex-end;
}

.btn-secondary {
  padding: 10px 20px;
  border: 1px solid var(--border-primary);
  background: var(--bg-card);
  color: var(--text-primary);
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-secondary:hover {
  border-color: var(--border-secondary);
  background: var(--bg-section);
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  padding: 10px 20px;
  border: none;
  background: var(--shopee-primary);
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #d94530;
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
</style>
