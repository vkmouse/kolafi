import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initializeAuth } from './services/authService'
import { registerSW } from 'virtual:pwa-register'

const app = createApp(App)

app.use(router)

// 註冊 Service Worker 並處理更新
const updateSW = registerSW({
  onNeedRefresh() {
    // 當有新版本可用時，發送自定義事件
    const event = new CustomEvent('sw:update', {
      detail: updateSW
    })
    window.dispatchEvent(event)
  },
  onOfflineReady() {
    console.log('應用程式已準備好離線使用')
  },
  onRegistered(registration) {
    console.log('Service Worker 已註冊')
    // 每小時檢查一次更新
    if (registration) {
      setInterval(() => {
        registration.update()
      }, 60 * 60 * 1000)
    }
  },
  onRegisterError(error) {
    console.error('Service Worker 註冊失敗:', error)
  }
})

// 初始化認證
initializeAuth()
  .then(() => {
    console.log('認證初始化成功')
    app.mount('#app')
  })
  .catch(error => {
    console.error('認證初始化失敗:', error)
    // 即使初始化失敗也繼續載入應用
    app.mount('#app')
  })
