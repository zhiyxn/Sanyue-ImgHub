<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { FolderOpen, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, UploadCloud } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import BrandMark from './BrandMark.vue'
import ThemeToggle from './ThemeToggle.vue'
import LanguageToggle from './LanguageToggle.vue'
import { useAppStore } from '@/stores/app'
import { api } from '@/services/api'

const props = withDefaults(defineProps<{ admin?: boolean; contained?: boolean }>(), {
  admin: false,
  contained: true,
})

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const mobileOpen = defineModel<boolean>('mobileOpen', { default: false })

const adminLinks = computed(() => [
  { to: '/dashboard', label: t('modern.nav.files'), icon: FolderOpen },
  { to: '/customerConfig', label: t('modern.nav.access'), icon: ShieldCheck },
  { to: '/systemConfig', label: t('modern.nav.settings'), icon: Settings },
])

const isAdminSession = computed(() => store.session.valid && store.session.authType === 'admin')

async function logout() {
  try {
    await api.logout(props.admin ? 'admin' : 'user')
  } finally {
    await store.refreshSession().catch(() => undefined)
    toast.success(t('modern.nav.logoutSuccess'))
    router.push(props.admin ? '/adminLogin' : '/login')
  }
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div class="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <RouterLink to="/" class="focus-ring rounded-lg">
          <BrandMark :name="store.siteTitle" :src="store.config.logoUrl" />
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
            <FolderOpen /> {{ t('modern.nav.browse') }}
          </Button>
          <Button v-if="!admin" variant="ghost" size="sm" @click="router.push(isAdminSession ? '/dashboard' : '/adminLogin')">
            <LayoutDashboard /> {{ t('modern.nav.admin') }}
          </Button>
          <ThemeToggle />
          <LanguageToggle />
          <Button v-if="store.session.valid" variant="ghost" size="icon" :aria-label="t('modern.nav.logout')" @click="logout">
            <LogOut />
          </Button>
          <Button v-if="admin" variant="ghost" size="icon" class="md:hidden" :aria-label="t('modern.nav.openNav')" @click="mobileOpen = !mobileOpen">
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
