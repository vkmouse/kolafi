<!--
  Cloudflare Access 驗證閘門：沒驗證過就顯示 Client ID/Secret 輸入畫面，
  通過才顯示 slot 內容並發出 `authenticated` 事件。

  isAuthenticated 是 accessService.js 的全域共享狀態，httpClient.js 判定
  session 真的復原不了時也會把它設回 false，這裡會自動切回輸入畫面。
-->
<script setup>
import { ref, watch, onMounted } from 'vue'
import {
  isAuthenticated,
  getStoredAccessCredentials,
  storeAccessCredentials,
  verifyAccessCredentials,
} from '../services/accessService'

const emit = defineEmits(['authenticated'])

/** 掛載時的第一次驗證是否還在進行中（跟送出表單後的 submitting 分開，避免畫面互相干擾）。 */
const checking = ref(true)
const errorMessage = ref('')

const clientIdInput = ref('')
const clientSecretInput = ref('')
const submitting = ref(false)

async function check() {
  const stored = getStoredAccessCredentials()
  if (!stored) {
    checking.value = false
    return
  }

  const ok = await verifyAccessCredentials()
  checking.value = false

  if (ok) {
    isAuthenticated.value = true
    emit('authenticated')
  } else {
    errorMessage.value = '驗證失敗，請確認 Client ID / Secret 是否正確'
  }
}

async function handleSubmit() {
  const clientId = clientIdInput.value.trim()
  const clientSecret = clientSecretInput.value.trim()
  if (!clientId || !clientSecret) {
    return
  }

  submitting.value = true
  errorMessage.value = ''

  // 先不寫 localStorage，直接拿使用者剛輸入的值去試；確認通過才真的存進
  // localStorage，避免把還沒驗證過、可能是打錯的憑證提早留在瀏覽器裡。
  const credentials = { clientId, clientSecret }
  const ok = await verifyAccessCredentials(credentials)

  if (ok) {
    storeAccessCredentials(credentials)
    isAuthenticated.value = true
    emit('authenticated')
  } else {
    errorMessage.value = '驗證失敗，請確認 Client ID / Secret 是否正確'
  }
  submitting.value = false
}

/** isAuthenticated 被 httpClient 設回 false 時，補一句提示文字說明原因。 */
watch(isAuthenticated, (nowAuthenticated) => {
  if (!nowAuthenticated && !checking.value) {
    errorMessage.value = '登入狀態已過期，請重新輸入 Client ID / Secret'
  }
})

onMounted(() => {
  check()
})
</script>

<template>
  <slot v-if="isAuthenticated" />

  <div v-else class="access-gate">
    <div class="access-gate__box">
      <template v-if="checking">
        <p class="access-gate__text">驗證中…</p>
      </template>

      <template v-else>
        <h1 class="access-gate__title">請輸入存取憑證</h1>
        <label class="access-gate__field">
          <span>Client ID</span>
          <input
            v-model="clientIdInput"
            type="text"
            autocomplete="off"
            spellcheck="false"
            :disabled="submitting"
            @keyup.enter="handleSubmit"
          />
        </label>
        <label class="access-gate__field">
          <span>Client Secret</span>
          <input
            v-model="clientSecretInput"
            type="password"
            autocomplete="off"
            spellcheck="false"
            :disabled="submitting"
            @keyup.enter="handleSubmit"
          />
        </label>
        <p v-if="errorMessage" class="access-gate__error">{{ errorMessage }}</p>
        <button
          class="access-gate__button"
          type="button"
          :disabled="submitting || !clientIdInput.trim() || !clientSecretInput.trim()"
          @click="handleSubmit"
        >
          {{ submitting ? '驗證中…' : '送出' }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.access-gate {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-section, #f8f8f8);
  color: var(--text-primary, #212121);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  box-sizing: border-box;
  padding: 24px;
}

.access-gate__box {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--bg-card, #ffffff);
  padding: 28px 24px;
  border-radius: 12px;
  box-shadow: var(--shadow-md, 0 2px 8px rgba(0, 0, 0, 0.08));
}

.access-gate__title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.access-gate__text {
  font-size: 14px;
  color: var(--text-secondary, #757575);
  margin: 0;
}

.access-gate__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary, #757575);
}

.access-gate__field input {
  padding: 9px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-primary, #e8e8e8);
  background: var(--bg-input, #ffffff);
  color: var(--text-primary, #212121);
  font-size: 14px;
  box-sizing: border-box;
}

.access-gate__field input:focus {
  outline: none;
  border-color: var(--border-focus, var(--shopee-primary, #ee4d2d));
}

.access-gate__field input:disabled {
  opacity: 0.6;
}

.access-gate__error {
  margin: 0;
  font-size: 13px;
  color: var(--shopee-error, #ff4249);
}

.access-gate__button {
  margin-top: 4px;
  padding: 10px;
  border-radius: 6px;
  border: none;
  background: var(--shopee-primary, #ee4d2d);
  color: var(--text-light, #ffffff);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.access-gate__button:hover:not(:disabled) {
  background: var(--shopee-primary-hover, #d73211);
}

.access-gate__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
