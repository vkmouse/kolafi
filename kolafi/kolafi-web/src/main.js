import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initializeAuth } from './services/authService'

const app = createApp(App)

app.use(router)

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
