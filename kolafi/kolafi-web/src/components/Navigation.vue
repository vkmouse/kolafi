<template>
  <nav class="navigation">
    <!-- 桌面版側邊欄 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2 class="sidebar-title">ShpAfiShort</h2>
      </div>
      
      <div class="sidebar-nav">
        <router-link to="/" class="nav-item" active-class="active" replace>
          <span class="nav-icon">
            <img :src="getIcon(DashboardIconActive, DashboardIconDefault, isActive('/'))" alt="Dashboard" />
          </span>
          <span class="nav-text">儀表板</span>
        </router-link>
        <router-link to="/projects" class="nav-item" active-class="active" replace>
          <span class="nav-icon">
            <img :src="getIcon(ProjectsIconActive, ProjectsIconDefault, isActive('/projects'))" alt="Projects" />
          </span>
          <span class="nav-text">專案清單</span>
        </router-link>
        <router-link to="/assets" class="nav-item" active-class="active" replace>
          <span class="nav-icon">
            <img :src="getIcon(AssetsIconActive, AssetsIconDefault, isActive('/assets'))" alt="Assets" />
          </span>
          <span class="nav-text">素材庫</span>
        </router-link>
      </div>
    </aside>

    <!-- 手機版底部導覽列 -->
    <div class="bottom-nav">
      <router-link to="/" class="bottom-nav-item" active-class="active" replace>
        <span class="nav-icon">
          <img :src="getIcon(DashboardIconActive, DashboardIconDefault, isActive('/'))" alt="Dashboard" />
        </span>
        <span class="nav-text">儀表板</span>
      </router-link>
      <router-link to="/projects" class="bottom-nav-item" active-class="active" replace>
        <span class="nav-icon">
          <img :src="getIcon(ProjectsIconActive, ProjectsIconDefault, isActive('/projects'))" alt="Projects" />
        </span>
        <span class="nav-text">專案清單</span>
      </router-link>
      <router-link to="/assets" class="bottom-nav-item" active-class="active" replace>
        <span class="nav-icon">
          <img :src="getIcon(AssetsIconActive, AssetsIconDefault, isActive('/assets'))" alt="Assets" />
        </span>
        <span class="nav-text">素材庫</span>
      </router-link>
    </div>
  </nav>
</template>

<script setup>
import { useRoute } from 'vue-router'
import DashboardIconDefault from './icons/DashboardIcon.svg'
import DashboardIconActive from './icons/DashboardIcon-active.svg'
import ProjectsIconDefault from './icons/ProjectsIcon.svg'
import ProjectsIconActive from './icons/ProjectsIcon-active.svg'
import AssetsIconDefault from './icons/AssetsIcon.svg'
import AssetsIconActive from './icons/AssetsIcon-active.svg'

const route = useRoute()

const isActive = (path) => {
  return route.path === path
}

const getIcon = (activeIcon, defaultIcon, condition) => {
  return condition ? activeIcon : defaultIcon
}
</script>

<style scoped>
.navigation {
  /* 容器樣式 */
}

/* 桌面版側邊欄 */
.sidebar {
  width: 240px;
  height: 100vh;
  background: var(--bg-card);
  border-right: 1px solid var(--border-primary);
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-secondary);
}

.sidebar-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--shopee-primary);
}

.sidebar-nav {
  padding: 16px 0;
  flex: 1;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  text-decoration: none;
  color: var(--text-secondary);
  transition: all 0.2s;
  border: none;
  background: none;
  width: 100%;
  cursor: pointer;
}

.nav-item:hover {
  background: var(--bg-section);
  color: var(--shopee-primary);
}

.nav-item.active {
  background: var(--shopee-primary-light);
  color: var(--shopee-primary);
  border-right: 3px solid var(--shopee-primary);
}

.nav-icon {
  margin-right: 12px;
}

.nav-text {
  font-size: 14px;
  font-weight: 500;
}

/* 手機版底部導覽列 */
.bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-card);
  border-top: 1px solid var(--border-primary);
  z-index: 100;
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 4px 32px 4px;
  text-decoration: none;
  color: var(--text-secondary);
  transition: all 0.2s;
  border-radius: 8px;
  flex: 1;
  font-size: 12px;
  text-align: center;
}

.bottom-nav-item.active {
  color: var(--shopee-primary);
}

.bottom-nav-item .nav-icon {
  margin-right: 0;
  margin-bottom: 4px;
}

.bottom-nav-item .nav-text {
  font-size: 11px;
  font-weight: 500;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .sidebar {
    display: none;
  }

  .bottom-nav {
    display: flex;
  }
}
</style>