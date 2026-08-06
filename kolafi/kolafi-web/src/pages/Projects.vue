<template>
  <div class="page-container">
    <header class="page-header">
      <div class="header-top">
        <h1 class="page-title">專案清單</h1>
        <div class="header-actions">
          <UserAvatar />
        </div>
      </div>
      
      <div class="tab-bar">
        <button 
          v-for="filter in filters" 
          :key="filter.status"
          class="tab-btn"
          :class="{ active: currentFilter === filter.status }"
          @click="changeFilter(filter.status)"
        >
          {{ filter.label }}({{ filter.count }})
        </button>
      </div>

      <div class="search-sort-bar">
        <div class="search-box">
          <input
            v-model="pendingSearch"
            class="search-input"
            type="text"
            placeholder="搜尋專案名稱..."
            @keyup.enter="applySearch"
          />
          <button class="search-btn" @click="applySearch" title="搜尋">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
        </div>
        <button class="sort-btn" @click="toggleSort" :title="sortOrder === 'desc' ? '目前：最新優先' : '目前：最舊優先'">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="2" x2="12" y2="22"/>
            <path v-if="sortOrder === 'desc'" d="M17 7l-5-5-5 5"/>
            <path v-else d="M17 17l-5 5-5-5"/>
          </svg>
          <span>{{ sortOrder === 'desc' ? '最新' : '最舊' }}</span>
        </button>
      </div>
    </header>

    <div class="content-section">
      <div v-if="isLoadingProjects" class="loading-state">
        <div class="loading-spinner">⟳</div>
        <p>載入中...</p>
      </div>

      <div v-else-if="loadError" class="error-state">
        <div class="error-icon">⚠️</div>
        <p>{{ loadError }}</p>
        <button class="btn-secondary" @click="fetchProjects">重試</button>
      </div>

      <div v-else class="projects-grid">
        <div 
          v-for="project in projects" 
          :key="project.id"
          class="project-card"
          @click="goToProject(project.id)"
        >
          <div class="project-header">
            <div class="project-name">{{ project.name }}</div>
            <div class="project-date">{{ formatDate(project.createdAt) }}</div>
          </div>
          
          <div class="project-footer">
            <div class="footer-right">
              <span v-if="project.hasActiveTask" class="badge task-badge">
                任務中
              </span>
              <span v-if="project.exportUrl" class="badge export-badge">
                已匯出
              </span>
              <span class="badge status-badge" :class="`status-${project.status}`">
                {{ statusMap[project.status] }}
              </span>
              <button
                class="delete-btn"
                @click.stop="openDeleteModal(project)"
                title="刪除專案"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/>
                  <path d="M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!isLoadingProjects && !loadError && projects.length === 0" class="empty-state">
        <div class="empty-icon">📂</div>
        <p>目前沒有{{ currentFilter === 'ALL' ? '' : statusMap[currentFilter] }}專案</p>
      </div>

      <!-- 分頁元件 -->
      <div v-if="!isLoadingProjects && !loadError && totalPages > 1" class="pagination">
        <button
          class="page-btn"
          :disabled="currentPage === 1"
          @click="changePage(currentPage - 1)"
        >‹</button>

        <template v-for="p in pageNumbers" :key="p">
          <span v-if="p === '...'" class="page-ellipsis">…</span>
          <button
            v-else
            class="page-btn"
            :class="{ active: p === currentPage }"
            @click="changePage(p)"
          >{{ p }}</button>
        </template>

        <button
          class="page-btn"
          :disabled="currentPage === totalPages"
          @click="changePage(currentPage + 1)"
        >›</button>
      </div>
    </div>

    <!-- 新增專案 Modal -->
    <CreateProjectModal
      :show="showCreateModal"
      @close="closeCreateModal"
      @create="handleCreateProject"
    />

    <!-- 刪除專案 Modal -->
    <DeleteProjectModal
      :show="!!deletingProject"
      :projectName="deletingProject?.name ?? ''"
      @close="deletingProject = null"
      @confirm="handleDeleteProject"
    />

    <!-- 懸浮新增按鈕 -->
    <button class="fab-btn" @click="openCreateModal" title="新增專案">
      <span class="fab-icon">+</span>
      <span class="fab-text">新增專案</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

defineOptions({ name: 'Projects' })
import { getCurrentUser } from '../services/authService'
import {
  getProjects,
  getProjectsStats,
  createProject
} from '../services/projectService'
import {
  createCaptionTask,
  createTagTask,
  createDownloadTask
} from '../services/taskService'
import { deleteProject } from '../services/projectService'
import CreateProjectModal from '../components/modals/CreateProjectModal.vue'
import DeleteProjectModal from '../components/modals/DeleteProjectModal.vue'
import UserAvatar from '../components/UserAvatar.vue'

const route = useRoute()
const router = useRouter()

// 狀態映射
const statusMap = {
  'DRAFT': '未處理',
  'PENDING': '待發佈',
  'PUBLISHED': '已發佈',
  'ALL': '全部'
}

// 當前使用者
const currentUser = ref(null)

// 專案數據
const projects = ref([])
const isLoadingProjects = ref(false)
const loadError = ref(null)

// 分頁狀態
const currentPage = ref(1)
const pageSize = 20
const totalPages = ref(1)
const totalCount = ref(0)

// 專案統計數據
const projectStats = ref({
  total: 0,
  draft: 0,
  pending: 0,
  published: 0
})

// 當前篩選狀態
const currentFilter = ref('ALL')

// 搜尋與排序狀態
const searchText = ref('')    // 已提交的搜尋關鍵字（與 URL 同步）
const pendingSearch = ref('') // 輸入框中的暫存文字
const sortOrder = ref('desc') // 排序方向: asc 或 desc

// 從 URL 讀取初始狀態
onMounted(() => {
  const status = route.query.status
  const page = parseInt(route.query.page) || 1
  const search = route.query.search ? decodeURIComponent(route.query.search) : ''
  const sort = route.query.sort

  if (status && ['DRAFT', 'PENDING', 'PUBLISHED'].includes(status)) {
    currentFilter.value = status
  }
  currentPage.value = page
  searchText.value = search
  pendingSearch.value = search
  if (sort === 'asc' || sort === 'desc') {
    sortOrder.value = sort
  }

  currentUser.value = getCurrentUser()
  Promise.all([fetchProjects(), fetchStats()])
})

// 監聽瀏覽器前進/後退（route query 變化）
watch(
  () => [route.query.status, route.query.page, route.query.search, route.query.sort],
  ([newStatus, newPage, newSearch, newSort]) => {
    const status = (newStatus && ['DRAFT', 'PENDING', 'PUBLISHED'].includes(newStatus)) ? newStatus : 'ALL'
    const page = parseInt(newPage) || 1
    const search = newSearch ? decodeURIComponent(newSearch) : ''
    const sort = (newSort === 'asc' || newSort === 'desc') ? newSort : 'desc'

    if (
      status !== currentFilter.value ||
      page !== currentPage.value ||
      search !== searchText.value ||
      sort !== sortOrder.value
    ) {
      currentFilter.value = status
      currentPage.value = page
      searchText.value = search
      pendingSearch.value = search
      sortOrder.value = sort
      fetchProjects()
    }
  }
)

// 從 API 獲取專案統計
const fetchStats = async () => {
  try {
    const response = await getProjectsStats()
    if (response.success && response.data) {
      projectStats.value = {
        total: response.data.total || 0,
        draft: response.data.draft || 0,
        pending: response.data.pending || 0,
        published: response.data.published || 0
      }
    }
  } catch (error) {
    console.error('獲取專案統計失敗:', error)
  }
}

// 從 API 獲取專案清單
const fetchProjects = async () => {
  isLoadingProjects.value = true
  loadError.value = null

  try {
    const response = await getProjects(currentFilter.value, currentPage.value, pageSize, searchText.value, sortOrder.value)

    if (response.success && response.data) {
      projects.value = response.data.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status || 'DRAFT',
        createdAt: p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        hasActiveTask: p.has_active_task || false,
        exportUrl: p.export_url || null
      }))

      if (response.pagination) {
        totalPages.value = response.pagination.total_pages || 1
        totalCount.value = response.pagination.total || 0
      }
    } else {
      loadError.value = response.error || '無法載入專案清單'
    }
  } catch (error) {
    loadError.value = '網路錯誤，無法載入專案'
    console.error('獲取專案出錯:', error)
  } finally {
    isLoadingProjects.value = false
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// 計算篩選選項和數量
const filters = computed(() => [
  { status: 'ALL',       label: '全部',   count: projectStats.value.total },
  { status: 'DRAFT',     label: '未處理', count: projectStats.value.draft },
  { status: 'PENDING',   label: '待發佈', count: projectStats.value.pending },
  { status: 'PUBLISHED', label: '已發佈', count: projectStats.value.published },
])

// 分頁按鈕的頁碼列表（最多顯示 7 個，含省略號）
const pageNumbers = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages = []
  pages.push(1)
  if (current > 4) pages.push('...')
  const start = Math.max(2, current - 2)
  const end = Math.min(total - 1, current + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 3) pages.push('...')
  pages.push(total)
  return pages
})

// 套用搜尋（按下放大鏡或 Enter）
const applySearch = () => {
  const newSearch = pendingSearch.value.trim()
  if (newSearch === searchText.value) return
  searchText.value = newSearch
  currentPage.value = 1
  syncURL()
  fetchProjects()
}

// 清除搜尋
const clearSearch = () => {
  pendingSearch.value = ''
  searchText.value = ''
  currentPage.value = 1
  syncURL()
  fetchProjects()
}

// 切換排序方向
const toggleSort = () => {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
  currentPage.value = 1
  syncURL()
  fetchProjects()
}

// 切換篩選
const changeFilter = (status) => {
  if (currentFilter.value === status) return
  currentFilter.value = status
  currentPage.value = 1
  syncURL()
  Promise.all([fetchProjects(), fetchStats()])
}

// 切換分頁
const changePage = (page) => {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return
  currentPage.value = page
  syncURL()
  fetchProjects()
}

// 同步 URL query string
const syncURL = () => {
  const query = {}
  if (currentFilter.value !== 'ALL') query.status = currentFilter.value
  if (currentPage.value > 1) query.page = currentPage.value
  if (searchText.value) query.search = encodeURIComponent(searchText.value)
  if (sortOrder.value !== 'desc') query.sort = sortOrder.value
  router.replace({ query })
}

// Modal 相關
const showCreateModal = ref(false)
const deletingProject = ref(null)

const openCreateModal = () => { showCreateModal.value = true }
const closeCreateModal = () => { showCreateModal.value = false }

const openDeleteModal = (project) => {
  deletingProject.value = { id: project.id, name: project.name }
}

const handleDeleteProject = async () => {
  if (!deletingProject.value) return
  const { id } = deletingProject.value
  try {
    const response = await deleteProject(id)
    if (response.success) {
      deletingProject.value = null
      await Promise.all([fetchStats(), fetchProjects()])
    } else {
      console.error('刪除專案失敗:', response.error)
    }
  } catch (error) {
    console.error('刪除專案出錯:', error)
  }
}

const handleCreateProject = async (projectName) => {
  try {
    const response = await createProject(projectName)

    if (response.success && response.data) {
      closeCreateModal()
      await Promise.all([fetchStats(), fetchProjects()])

      const projectId = response.data.id
      try { await createCaptionTask(projectId) } catch (e) { console.error('建立文案生成任務失敗:', e) }
      try { await createTagTask(projectId) } catch (e) { console.error('建立標籤生成任務失敗:', e) }
      try { await createDownloadTask(projectId, []) } catch (e) { console.error('建立素材下載任務失敗:', e) }
    } else {
      console.error('建立專案失敗:', response.error)
    }
  } catch (error) {
    console.error('建立專案出錯:', error)
  }
}

// 前往專案頁面
const goToProject = (projectId) => {
  const query = {}
  if (currentFilter.value !== 'ALL') query.from = currentFilter.value
  if (currentPage.value > 1) query.fromPage = currentPage.value
  router.push({ path: `/projects/${projectId}`, query })
}

// 格式化日期
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}
</script>

<style scoped>
/* 頁面內容區域 */
.content-section {
  padding: 0 16px;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
  min-height: 400px;
}

.loading-spinner {
  font-size: 48px;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.loading-state p {
  font-size: 16px;
  color: var(--text-secondary);
}

.error-state {
  color: var(--shopee-error);
}

.error-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.error-state p {
  font-size: 16px;
  margin-bottom: 24px;
  color: var(--text-primary);
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 8px;
}

.project-card {
  background: var(--bg-card);
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
}

.project-card:hover {
  border-color: var(--shopee-primary);
}

.project-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
}

.project-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  word-break: break-word;
  line-height: 1.3;
}

.project-date {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.project-footer {
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.delete-btn:hover {
  border-color: #ee4444;
  background: #fff0f0;
  color: #ee4444;
}

.badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.task-badge {
  background: var(--shopee-primary-light);
  color: var(--shopee-primary);
}

.export-badge {
  background: #E8F4FF;
  color: var(--shopee-info);
}

.status-DRAFT {
  background: var(--bg-section);
  color: var(--text-secondary);
}

.status-PENDING {
  background: #FFF3CD;
  color: #856404;
}

.status-PUBLISHED {
  background: var(--shopee-success-light);
  color: var(--shopee-success);
}

/* 分頁元件 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 24px 0 16px;
  flex-wrap: wrap;
}

.page-btn {
  min-width: 36px;
  height: 36px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--border-primary);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--shopee-primary);
  color: var(--shopee-primary);
}

.page-btn.active {
  background: var(--shopee-primary);
  border-color: var(--shopee-primary);
  color: #fff;
  font-weight: 600;
}

.page-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.page-ellipsis {
  min-width: 36px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 36px;
}

/* 搜尋與排序列 */
.search-sort-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px 12px;
}

.search-box {
  display: flex;
  align-items: center;
  flex: 1;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.15s;
}

.search-box:focus-within {
  border-color: var(--shopee-primary);
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  padding: 8px 10px;
  font-size: 14px;
  background: transparent;
  color: var(--text-primary);
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  height: 36px;
  border: none;
  background: var(--shopee-primary);
  color: #fff;
  cursor: pointer;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.search-btn:hover {
  opacity: 0.85;
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.15s;
  flex-shrink: 0;
}

.clear-btn:hover {
  color: var(--shopee-error, #ee4d2d);
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  height: 36px;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.15s, color 0.15s;
  flex-shrink: 0;
}

.sort-btn:hover {
  border-color: var(--shopee-primary);
  color: var(--shopee-primary);
}

@media (max-width: 768px) {
  .search-sort-bar {
    padding: 6px 8px 10px;
  }

  .sort-btn span {
    display: none;
  }

  .sort-btn {
    padding: 0 10px;
  }
}

/* 懸浮按鈕樣式 */
.fab-btn {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 50px;
  background-color: var(--shopee-primary);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fab-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.fab-icon {
  font-size: 20px;
  line-height: 1;
}

@media (max-width: 768px) {
  .content-section {
    padding: 0;
  }
  
  .projects-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
  
  .project-card {
    border-radius: 0;
  }
  
  .project-card:not(:last-child) {
    border-bottom: none;
  }
  
  .project-name {
    font-size: 15px;
  }
  
  .badge {
    font-size: 10px;
    padding: 3px 10px;
  }

  .pagination {
    padding: 16px 8px 12px;
    gap: 3px;
  }

  .page-btn {
    min-width: 32px;
    height: 32px;
    font-size: 13px;
  }

  .fab-btn {
    bottom: 100px;
    right: 16px;
    width: 36px;
    height: 36px;
    padding: 0;
    justify-content: center;
    border-radius: 50%;
  }

  .fab-text {
    display: none;
  }

  .fab-icon {
    font-size: 24px;
  }
}
</style>
