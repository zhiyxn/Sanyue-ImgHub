<script setup lang="ts">
import { Languages } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const { t } = useI18n()

function toggle() {
  store.setLocale(store.locale === 'zh-CN' ? 'en' : 'zh-CN')
}
</script>

<template>
  <Button variant="ghost" size="icon" :aria-label="t('language.switchLanguage')" :title="t('language.switchLanguage')" @click="toggle">
    <Languages />
  </Button>
</template>
