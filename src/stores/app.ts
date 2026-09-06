import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/services/api'
import type { SessionState, UserConfig } from '@/types/api'
import { applyLocale, getStoredLocale } from '@/locales'
import type { AppLocale } from '@/locales'

export const useAppStore = defineStore(
  'app',
  () => {
    const config = ref<UserConfig>({})
    const session = ref<SessionState>({ valid: false, adminRequired: true, userRequired: true })
    const ready = ref(false)
    const theme = ref<'light' | 'dark' | 'system'>('system')
    const locale = ref<AppLocale>(getStoredLocale() || 'zh-CN')
    const ownerName = computed(() => config.value.ownerName || 'Sanyue')
    const siteTitle = computed(() => config.value.siteTitle || `${ownerName.value} ImgHub`)

    async function bootstrap() {
      const [configResult, sessionResult] = await Promise.allSettled([api.userConfig(), api.session()])
      if (configResult.status === 'fulfilled') {
        config.value = configResult.value
        if (!getStoredLocale()) locale.value = config.value.defaultLanguage || locale.value
        applyLocale(locale.value)
      }
      if (sessionResult.status === 'fulfilled') session.value = sessionResult.value
      ready.value = true
    }

    async function refreshSession() {
      session.value = await api.session()
      return session.value
    }

    function setLocale(value: AppLocale) {
      locale.value = value
      applyLocale(value)
    }

    return { config, session, ready, theme, locale, ownerName, siteTitle, bootstrap, refreshSession, setLocale }
  },
  { persist: { pick: ['theme', 'locale'] } },
)
