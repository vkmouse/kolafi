<!--
  Cloudflare Access（Service Token）驗證閘門。

  用法：把要保護的內容放進預設 slot，掛載時會自動檢查 localStorage 裡有沒有
  存憑證、帶著憑證打一次 /api/users 試探：
    - 通過（不管業務邏輯回什麼，只要不是 401/403）→ 顯示 slot 內容，並發出
      `authenticated` 事件（父層可以藉此知道「現在才可以開始打其他 API」）
    - 沒存值，或被 Access edge 擋下（401/403）、網路錯誤等 → 顯示輸入畫面 +
      錯誤訊息，唯一能做的動作就是「重新輸入一次」

  後端完全不驗證這組憑證——正式環境靠 Cloudflare Access edge 在請求進到
  kolafi-web 之前就先擋掉，所以「試探成功」只代表 edge 認得這組 Service
  Token，不代表任何業務邏輯上的意義。
-->
<script setup>
import { ref, onMounted } from 'vue'
import {
  getStoredAccessCredentials,
  storeAccessCredentials,
  verifyAccessCredentials,
} from '../services/accessService'

const emit = defineEmits(['authenticated'])

/** 是否已經通過驗證、可以顯示 slot 內容。 */
const authenticated = ref(false)
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
    authenticated.value = true
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
    authenticated.value = true
    emit('authenticated')
  } else {
    errorMessage.value = '驗證失敗，請確認 Client ID / Secret 是否正確'
  }
  submitting.value = false
}

onMounted(() => {
  check()
})
</script>

<template>
  <slot v-if="authenticated" />

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
