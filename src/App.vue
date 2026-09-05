<script setup lang="ts">
import { watchEffect } from 'vue'
import { RouterView } from 'vue-router'
import { Toaster } from 'vue-sonner'
import { useAppStore } from '@/stores/app'
import { useTheme } from '@/composables/useTheme'

const store = useAppStore()
useTheme()

watchEffect(() => {
  document.title = store.siteTitle
  document.documentElement.lang = store.locale
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', store.config.siteIcon || '/brand-mark.svg')
})
</script>

<template>
  <RouterView />
  <Toaster position="top-center" rich-colors close-button />
</template>
