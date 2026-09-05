<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { FolderOpen, LogOut, Menu, Settings, ShieldCheck, UploadCloud } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import BrandMark from './BrandMark.vue'
import ThemeToggle from './ThemeToggle.vue'
import { useAppStore } from '@/stores/app'
import { api } from '@/services/api'

const props = withDefaults(defineProps<{ admin?: boolean; contained?: boolean }>(), {
  admin: false,
  contained: true,
})

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const mobileOpen = defineModel<boolean>('mobileOpen', { default: false })

const adminLinks = [
  { to: '/dashboard', label: '文件管理', icon: FolderOpen },
  { to: '/customerConfig', label: '访问规则', icon: ShieldCheck },
  { to: '/systemConfig', label: '系统设置', icon: Settings },
]

const isAdminSession = computed(() => store.session.valid && store.session.authType === 'admin')

async function logout() {
  try {
    await api.logout(props.admin ? 'admin' : 'user')
  } finally {
    await store.refreshSession().catch(() => undefined)
    toast.success('已安全退出')
    router.push(props.admin ? '/adminLogin' : '/login')
  }
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div class="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <RouterLink to="/" class="focus-ring rounded-lg">
          <BrandMark :name="store.siteTitle" />
        </RouterLink>

        <nav v-if="admin" class="ml-5 hidden items-center gap-1 md:flex">
          <RouterLink
            v-for="item in adminLinks"
            :key="item.to"
            :to="item.to"
            class="focus-ring inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
            :class="route.path === item.to && 'bg-accent text-foreground'"
          >
            <component :is="item.icon" class="size-4" />
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="ml-auto flex items-center gap-1">
          <Button v-if="!admin" variant="ghost" size="sm" as-child @click="router.push('/browse')">
            <FolderOpen /> 浏览
          </Button>
          <Button v-if="!admin && isAdminSession" variant="ghost" size="sm" @click="router.push('/dashboard')">
            <Settings /> 管理
          </Button>
          <ThemeToggle />
          <Button v-if="store.session.valid" variant="ghost" size="icon" aria-label="退出登录" @click="logout">
            <LogOut />
          </Button>
          <Button v-if="admin" variant="ghost" size="icon" class="md:hidden" aria-label="打开导航" @click="mobileOpen = !mobileOpen">
            <Menu />
          </Button>
        </div>
      </div>

      <nav v-if="admin && mobileOpen" class="border-t p-2 md:hidden">
        <RouterLink
          v-for="item in adminLinks"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
          :class="route.path === item.to ? 'bg-accent' : 'text-muted-foreground'"
          @click="mobileOpen = false"
        >
          <component :is="item.icon" class="size-4" />
          {{ item.label }}
        </RouterLink>
      </nav>
    </header>

    <main :class="contained ? 'mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8' : ''">
      <slot />
    </main>

    <footer v-if="!store.config.disableFooter" class="border-t">
      <div class="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span class="inline-flex items-center gap-1.5"><UploadCloud class="size-3.5" /> {{ store.siteTitle }}</span>
        <a class="hover:text-foreground" href="https://github.com/zhiyxn/CloudFlare-ImgBed" target="_blank" rel="noreferrer">Powered by Cloudflare</a>
      </div>
    </footer>
  </div>
</template>
