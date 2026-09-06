<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { KeyRound, LoaderCircle, LockKeyhole, UserRound } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import BrandMark from './BrandMark.vue'
import ThemeToggle from './ThemeToggle.vue'
import LanguageToggle from './LanguageToggle.vue'
import { api } from '@/services/api'
import { useAppStore } from '@/stores/app'

const props = withDefaults(defineProps<{ admin?: boolean }>(), { admin: false })
const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { t } = useI18n()
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  if (!password.value || (props.admin && !username.value)) return
  loading.value = true
  error.value = ''
  try {
    if (props.admin) await api.adminLogin(username.value, password.value)
    else await api.login(password.value)
    await store.refreshSession()
    toast.success(t('modern.auth.success'))
    const fallback = props.admin ? '/dashboard' : '/'
    router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : fallback)
  } catch (reason) {
    error.value = reason instanceof Error && reason.message === 'Unauthorized' ? t('modern.auth.invalid') : reason instanceof Error ? reason.message : t('modern.auth.failed')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-10">
    <div class="surface-grid pointer-events-none absolute inset-0 opacity-65" />
    <div class="absolute right-4 top-4 flex gap-1"><ThemeToggle /><LanguageToggle /></div>
    <div class="relative w-full max-w-sm">
      <div class="mb-7 flex justify-center"><BrandMark size="lg" :name="store.siteTitle" :src="store.config.logoUrl" /></div>
      <Card class="p-6 sm:p-7">
        <div class="mb-6">
          <h1 class="text-xl font-semibold tracking-tight">{{ t(admin ? 'modern.auth.adminTitle' : 'modern.auth.userTitle') }}</h1>
          <p class="mt-1.5 text-sm text-muted-foreground">{{ t(admin ? 'modern.auth.adminDescription' : 'modern.auth.userDescription') }}</p>
        </div>
        <form class="space-y-4" @submit.prevent="submit">
          <Alert v-if="error" variant="destructive">{{ error }}</Alert>
          <div v-if="admin" class="space-y-2">
            <Label for="username">{{ t('modern.auth.username') }}</Label>
            <div class="relative"><UserRound class="absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="username" v-model="username" class="pl-9" autocomplete="username" autofocus /></div>
          </div>
          <div class="space-y-2">
            <Label for="password">{{ t(admin ? 'modern.auth.password' : 'modern.auth.accessPassword') }}</Label>
            <div class="relative"><KeyRound v-if="!admin" class="absolute left-3 top-3 size-4 text-muted-foreground" /><LockKeyhole v-else class="absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="password" v-model="password" type="password" class="pl-9" autocomplete="current-password" :autofocus="!admin" /></div>
          </div>
          <Button class="mt-2 w-full" size="lg" type="submit" :disabled="loading || !password || (admin && !username)">
            <LoaderCircle v-if="loading" class="animate-spin" />{{ t(loading ? 'modern.auth.checking' : 'modern.auth.login') }}
          </Button>
        </form>
      </Card>
      <div class="mt-5 flex justify-center gap-4 text-xs text-muted-foreground">
        <RouterLink to="/" class="hover:text-foreground">{{ t('modern.auth.backUpload') }}</RouterLink>
        <RouterLink v-if="!admin" to="/adminLogin" class="hover:text-foreground">{{ t('modern.auth.adminLogin') }}</RouterLink>
      </div>
    </div>
  </div>
</template>
