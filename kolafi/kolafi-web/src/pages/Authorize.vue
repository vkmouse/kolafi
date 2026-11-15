<!--
  OAuth 授權畫面。

  第三方網站（MCP client）把使用者導到 /authorize?...，這個畫面由 AccessGate 把關
  （需要憑證時由 AccessGate 顯示輸入畫面），通過後立刻呼叫授權端點：
    200 → 導回第三方網站（回呼網址帶 code）
    400 → 在這個畫面顯示錯誤，不導回第三方網站
    其他 → 顯示通用錯誤，不導回第三方網站
-->
<script setup>
import { onMounted, ref } from 'vue'
import { readAuthorizeParams, requestAuthorization } from '../services/oauthService'

const DEFAULT_ERROR_MESSAGE = '授權請求無法完成'

const ERROR_MESSAGES = {
  invalid_request: '授權請求的參數不完整或不正確',
  invalid_client: '找不到這個應用程式的註冊資料',
  unsupported_response_type: '不支援這種授權回應類型',
  invalid_target: '授權請求指定的資源不是本站的 MCP 伺服器',
}

const params = readAuthorizeParams(window.location.search)

/** 'submitting' | 'error' | 'redirecting' */
const status = ref('submitting')
const errorMessage = ref('')

function applyResult(result) {
  if (result.kind === 'redirect') {
    status.value = 'redirecting'
    window.location.assign(result.url)
    return
  }

  errorMessage.value =
    result.kind === 'rejected'
      ? (ERROR_MESSAGES[result.error] ?? DEFAULT_ERROR_MESSAGE)
      : DEFAULT_ERROR_MESSAGE
  status.value = 'error'
}

onMounted(async () => {
  applyResult(await requestAuthorization(params))
})
</script>

<template>
  <div class="authorize">
    <div class="authorize__box">
      <p v-if="status === 'submitting'" class="authorize__text">處理授權中…</p>

      <p v-else-if="status === 'redirecting'" class="authorize__text">授權完成，正在返回原網站…</p>

      <template v-else>
        <h1 class="authorize__title">無法完成授權</h1>
        <p class="authorize__text">{{ errorMessage }}</p>
        <p class="authorize__text">這次沒有導回原網站，請回到原網站重新發起授權。</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.authorize {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-section, #f8f8f8);
  color: var(--text-primary, #212121);
  box-sizing: border-box;
  padding: 24px;
}

.authorize__box {
  width: 100%;
  max-width: 340px;
  background: var(--bg-card, #ffffff);
  padding: 28px 24px;
  border-radius: 12px;
  box-shadow: var(--shadow-md, 0 2px 8px rgba(0, 0, 0, 0.08));
}

.authorize__title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 14px;
}

.authorize__text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary, #757575);
  margin: 0 0 10px;
}
</style>
