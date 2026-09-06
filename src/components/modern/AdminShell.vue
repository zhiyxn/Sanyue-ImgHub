<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  Activity,
  FolderOpen,
  GitFork,
  Images,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  ShieldCheck,
  UploadCloud,
  Users,
  X,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import BrandMark from './BrandMark.vue'
import ThemeToggle from './ThemeToggle.vue'
import { api } from '@/services/api'
import { useAppStore } from '@/stores/app'

defineProps<{
  title: string
  description?: string
}>()

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const collapsed = ref(false)
const mobileOpen = ref(false)

const primaryLinks = [
  { to: '/dashboard', label: '系统状态', icon: Activity, exact: true },
  { to: '/dashboard/files', label: '文件管理', icon: FolderOpen },
  { to: '/dashboard/users', label: '用户管理', icon: Users },
  { to: '/dashboard/access', label: '访问规则', icon: ShieldCheck },
  { to: '/dashboard/settings', label: '系统设置', icon: Settings2 },
]

const secondaryLinks = [
  { to: '/', label: '返回上传页', icon: UploadCloud },
  { to: '/browse', label: '公开浏览', icon: Images },
]

const isCurrent = (item: { to: string; exact?: boolean }) =>
  item.exact ? route.path === item.to : route.path.startsWith(item.to)

const sidebarWidth = computed(() => (collapsed.value ? 'lg:w-[72px]' : 'lg:w-64'))

async function logout() {
  try {
    await api.logout('admin')
  } finally {
    await store.refreshSession().catch(() => undefined)
    toast.success('已安全退出管理后台')
    router.push('/adminLogin')
  }
}
</script>

<template>
  <div class="min-h-screen bg-muted/25 lg:flex">
    <button
      v-if="mobileOpen"
      type="button"
      class="fixed inset-0 z-40 bg-stone-950/45 lg:hidden"
      aria-label="关闭后台导航"
      @click="mobileOpen = false"
    />

    <aside
      class="fixed inset-y-0 left-0 z-50 flex w-64 -translate-x-full flex-col border-r bg-card transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0"
      :class="[sidebarWidth, mobileOpen && 'translate-x-0']"
    >
      <div class="flex h-16 items-center gap-2 border-b px-3" :class="collapsed && 'lg:justify-center'">
        <RouterLink to="/dashboard" class="focus-ring min-w-0 rounded-lg" @click="mobileOpen = false">
          <BrandMark :name="store.siteTitle" :src="store.config.logoUrl" size="sm" :show-name="!collapsed" />
        </RouterLink>
        <Button class="ml-auto lg:hidden" variant="ghost" size="icon" aria-label="关闭导航" @click="mobileOpen = false">
          <X />
        </Button>
      </div>

      <div class="flex-1 overflow-y-auto px-2 py-4">
        <p v-if="!collapsed" class="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">管理</p>
        <nav class="space-y-1" aria-label="后台导航">
          <RouterLink
            v-for="item in primaryLinks"
            :key="item.to"
            :to="item.to"
            class="focus-ring group flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors"
            :class="isCurrent(item) ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
            :title="collapsed ? item.label : undefined"
            @click="mobileOpen = false"
          >
            <component :is="item.icon" class="size-4 shrink-0" />
            <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
          </RouterLink>
        </nav>

        <Separator class="my-4" />
        <p v-if="!collapsed" class="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">站点</p>
        <nav class="space-y-1" aria-label="站点导航">
          <RouterLink
            v-for="item in secondaryLinks"
            :key="item.to"
            :to="item.to"
            class="focus-ring flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            :title="collapsed ? item.label : undefined"
            @click="mobileOpen = false"
          >
            <component :is="item.icon" class="size-4 shrink-0" />
            <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
          </RouterLink>
          <a
            href="https://github.com/zhiyxn/CloudFlare-ImgBed"
            target="_blank"
            rel="noreferrer"
            class="focus-ring flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            :title="collapsed ? '项目仓库' : undefined"
          >
            <GitFork class="size-4 shrink-0" />
            <span v-if="!collapsed" class="truncate">项目仓库</span>
          </a>
        </nav>
      </div>

      <div class="border-t p-2">
        <div class="flex items-center gap-2 rounded-lg p-2" :class="collapsed && 'lg:justify-center'">
          <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-stone-900 text-xs font-semibold text-stone-50 dark:bg-stone-100 dark:text-stone-900">AD</span>
          <div v-if="!collapsed" class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">管理员</p>
            <p class="truncate text-xs text-muted-foreground">已通过后台认证</p>
          </div>
          <Button v-if="!collapsed" variant="ghost" size="icon" aria-label="退出后台" @click="logout"><LogOut /></Button>
        </div>
      </div>
    </aside>

    <section class="min-w-0 flex-1">
      <header class="sticky top-0 z-30 flex h-16 items-center border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
        <Button variant="ghost" size="icon" class="mr-2 lg:hidden" aria-label="打开后台导航" @click="mobileOpen = true"><Menu /></Button>
        <Button variant="ghost" size="icon" class="mr-3 hidden lg:inline-flex" :aria-label="collapsed ? '展开侧栏' : '收起侧栏'" @click="collapsed = !collapsed">
          <PanelLeftOpen v-if="collapsed" />
          <PanelLeftClose v-else />
        </Button>
        <Separator orientation="vertical" class="mr-4 hidden h-5 lg:block" />
        <div class="min-w-0">
          <h1 class="truncate text-sm font-semibold sm:text-base">{{ title }}</h1>
          <p v-if="description" class="hidden truncate text-xs text-muted-foreground sm:block">{{ description }}</p>
        </div>
        <div class="ml-auto flex items-center gap-1">
          <slot name="header-actions" />
          <ThemeToggle />
        </div>
      </header>

      <main class="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
        <slot />
      </main>
    </section>
  </div>
</template>
