<script setup>
import Navigation from './components/Navigation.vue'
</script>

<template>
  <div class="app">
    <Navigation />
    <main class="content">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>
  </div>
</template>

<style>
/* Shopee Brand Color System */
:root {
  /* 核心品牌色彩 */
  --shopee-primary: #EE4D2D;
  --shopee-primary-hover: #D73211;
  --shopee-primary-light: #FFEEE8;
  
  /* 功能與狀態色彩 */
  --shopee-success: #26AA99;
  --shopee-success-light: #E0F5F3;
  --shopee-error: #FF4249;
  --shopee-error-light: #FFE8E9;
  --shopee-rating: #FFCE3D;
  --shopee-info: #4D9FFF;
  
  /* 文字色彩 */
  --text-primary: #212121;
  --text-secondary: #757575;
  --text-tertiary: #999999;
  --text-disabled: #CCCCCC;
  --text-light: #FFFFFF;
  
  /* 背景色彩 */
  --bg-page: #FFFFFF;
  --bg-body: #FFFFFF;
  --bg-card: #FFFFFF;
  --bg-card-hover: #FAFAFA;
  --bg-section: #F8F8F8;
  --bg-input: #FFFFFF;
  
  /* 邊框與分割線 */
  --border-primary: #E8E8E8;
  --border-secondary: #F0F0F0;
  --border-dark: #D8D8D8;
  --border-focus: var(--shopee-primary);
  --divider: #E8E8E8;
  
  /* 陰影系統 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 8px 24px rgba(0, 0, 0, 0.12);
  --shadow-hover: 0 4px 12px rgba(238, 77, 45, 0.15);
  
  /* 互動狀態 */
  --selected-bg: var(--shopee-primary-light);
  --selected-border: var(--shopee-primary);
  
  /* Spacing */
  --container-padding-desktop: 20px;
  --container-padding-mobile: 8px;
  --header-spacing: 24px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg-page);
  color: var(--text-primary);
  min-height: 100vh;
}

.app {
  min-height: 100vh;
}

.content {
  flex: 1;
  margin-left: 240px;
}

/* ========================================
   共用 Layout 樣式
   ======================================== */

/* 統一容器 */
.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--container-padding-desktop);
}

/* 統一頁面標頭 */
.page-header {
  margin-bottom: var(--header-spacing);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: var(--shopee-primary);
}

/* Tab Bar 樣式 */
.tab-bar {
  display: flex;
}

.tab-btn {
  flex: 1;
  padding: 12px 16px;
  border: none;
  border-radius: 0;
  border-bottom: 1px solid var(--border-primary);
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.2s;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.tab-btn:hover {
  color: var(--shopee-primary);
}

.tab-btn:hover .count {
  color: var(--shopee-primary);
}

.tab-btn.active {
  color: var(--shopee-primary);
  border-bottom: 2px solid var(--shopee-primary);
}

.tab-btn .count {
  padding: 2px 8px;
  background: var(--border-primary);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.tab-btn.active .count {
  background: transparent;
  color: var(--shopee-primary);
}

/* 按鈕樣式 */
.btn-primary {
  padding: 10px 20px;
  background: var(--shopee-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: var(--shopee-primary-hover);
  box-shadow: var(--shadow-md);
}

.btn-secondary {
  padding: 10px 20px;
  background: var(--bg-body);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: var(--bg-section);
}

/* 卡片樣式 */
.card {
  background: var(--bg-card);
  border-radius: 12px;
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s;
}

.card:hover {
  box-shadow: var(--shadow-md);
}

/* 空狀態 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: var(--bg-card);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  color: var(--text-secondary);
  font-size: 16px;
}

/* Modal 樣式 */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  overflow-y: auto;
}

.modal-content {
  background: var(--bg-card);
  width: 90%;
  max-width: 500px;
  padding: 32px;
  border-radius: 16px;
  box-shadow: var(--shadow-xl);
  margin: 20px;
}

.modal-header {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 24px;
  color: var(--text-primary);
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

/* 表單樣式 */
.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-weight: 500;
  font-size: 14px;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--shopee-primary);
}

/* ========================================
   響應式設計 (RWD)
   ======================================== */

@media (max-width: 768px) {
  .page-container {
    padding: var(--container-padding-mobile);
  }
  
  .content {
    margin-left: 0;
    padding-bottom: 80px; /* 為底部導覽列留空間 */
  }
  
  .page-header {
    margin-bottom: 16px;
  }
  
  .header-top {
    flex-direction: row;
    align-items: center;
    gap: 12px;
    justify-content: space-between;
  }
  
  .btn-primary {
    width: auto;
    font-size: 13px;
    padding: 8px 12px;
    white-space: nowrap;
  }
  
  .tab-btn {
    padding: 10px 12px;
    font-size: 13px;
    gap: 4px;
  }
  
  .tab-btn .count {
    font-size: 11px;
    padding: 2px 6px;
  }

  .empty-state {
    padding: 40px 16px;
  }
  
  .empty-icon {
    font-size: 48px;
  }
  
  .empty-state p {
    font-size: 14px;
  }
  
  .modal-content {
    padding: 24px;
  }
  
  .modal-header {
    font-size: 18px;
  }
}

/* Mobile tap highlight fix */
@media (max-width: 768px) {
  button,
  a,
  div,
  [role="button"] {
    -webkit-tap-highlight-color: transparent;
  }
}

</style>
