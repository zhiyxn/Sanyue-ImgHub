import { watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useAppStore } from '@/stores/app'

let initialized = false

export function useTheme() {
  const store = useAppStore()
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')

  function applyTheme() {
    const isDark = store.theme === 'dark' || (store.theme === 'system' && systemDark.value)
    document.documentElement.classList.toggle('dark', isDark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#1c1917' : '#f7f6f3')
  }

  if (!initialized) {
    watch([() => store.theme, systemDark], applyTheme, { immediate: true })
    initialized = true
  }

  function toggle() {
    store.theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark'
  }

  return { toggle }
}
