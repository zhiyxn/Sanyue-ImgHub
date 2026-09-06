<script setup lang="ts">
import AppShell from '@/components/modern/AppShell.vue'
import FileBrowser from '@/components/modern/FileBrowser.vue'
import PageHeading from '@/components/modern/PageHeading.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>
<template>
  <AppShell>
    <div class="mb-7"><PageHeading :eyebrow="t('modern.public.eyebrow')" :title="t('modern.public.title')" :description="t('modern.public.description')" /></div>
    <FileBrowser mode="public" />
  </AppShell>
</template>
