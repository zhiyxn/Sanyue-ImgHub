import { createRouter, createWebHistory } from 'vue-router'
import { api } from '@/services/api'

const routes = [
  { path: '/', name: 'home', component: () => import('@/views-modern/UploadPage.vue'), meta: { user: true } },
  { path: '/login', name: 'login', component: () => import('@/views-modern/LoginPage.vue') },
  { path: '/adminLogin', name: 'adminLogin', component: () => import('@/views-modern/AdminLoginPage.vue') },
  { path: '/dashboard', name: 'dashboard', component: () => import('@/views-modern/DashboardPage.vue'), meta: { admin: true } },
  { path: '/systemConfig', name: 'systemConfig', component: () => import('@/views-modern/SystemSettingsPage.vue'), meta: { admin: true } },
  { path: '/customerConfig', name: 'customerConfig', component: () => import('@/views-modern/AccessSettingsPage.vue'), meta: { admin: true } },
  { path: '/browse/:dir(.*)*', name: 'publicBrowse', component: () => import('@/views-modern/PublicBrowsePage.vue') },
  { path: '/blockimg', name: 'blockimg', component: () => import('@/views-modern/StatusPage.vue'), props: { kind: 'blocked' } },
  { path: '/whiteliston', name: 'whiteliston', component: () => import('@/views-modern/StatusPage.vue'), props: { kind: 'whitelist' } },
  { path: '/:pathMatch(.*)*', name: 'notFound', component: () => import('@/views-modern/StatusPage.vue'), props: { kind: 'not-found' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  if (!to.meta.admin && !to.meta.user) return true
  try {
    const session = await api.session()
    if (to.meta.admin && session.adminRequired && !(session.valid && session.authType === 'admin')) {
      return { name: 'adminLogin', query: { redirect: to.fullPath } }
    }
    if (to.meta.user && session.userRequired && !session.valid) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    return true
  } catch {
    return { name: to.meta.admin ? 'adminLogin' : 'login', query: { redirect: to.fullPath } }
  }
})

export default router
