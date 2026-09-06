<script setup lang="ts">
import { Monitor, Moon, Sun } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app'
import { useI18n } from 'vue-i18n'

const store = useAppStore()
const { t } = useI18n()
const themes = ['light', 'dark', 'system'] as const

function cycleTheme() {
  const index = themes.indexOf(store.theme)
  store.theme = themes[(index + 1) % themes.length] ?? 'system'
}
</script>

<template>
  <Button variant="ghost" size="icon" :aria-label="t(store.theme === 'light' ? 'theme.lightMode' : store.theme === 'dark' ? 'theme.darkMode' : 'theme.autoMode')" @click="cycleTheme">
    <Sun v-if="store.theme === 'light'" />
    <Moon v-else-if="store.theme === 'dark'" />
    <Monitor v-else />
  </Button>
</template>
