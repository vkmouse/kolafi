import { createRouter, createWebHistory } from 'vue-router'
import Home from '../pages/Home.vue'
import Projects from '../pages/Projects.vue'
import ProjectDetail from '../pages/ProjectDetail.vue'
import Assets from '../pages/Assets.vue'
import Authorize from '../pages/Authorize.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/projects',
    name: 'Projects',
    component: Projects
  },
  {
    path: '/projects/:id',
    name: 'ProjectDetail',
    component: ProjectDetail
  },
  {
    path: '/assets',
    name: 'Assets',
    component: Assets
  },
  {
    // OAuth 授權畫面：第三方網站把使用者導到這裡，不需要側邊導覽列
    path: '/authorize',
    name: 'Authorize',
    component: Authorize,
    meta: { hideNavigation: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
