<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AdminShell from '@/components/modern/AdminShell.vue'
import FileBrowser from '@/components/modern/FileBrowser.vue'
import PageHeading from '@/components/modern/PageHeading.vue'

const { t } = useI18n()
</script>
<template>
  <AdminShell :title="t('modern.nav.files')" :description="t('modern.files.pageDescription')">
    <div class="mb-7"><PageHeading :eyebrow="t('modern.files.pageEyebrow')" :title="t('modern.nav.files')" :description="t('modern.files.pageDescription')" /></div>
    <FileBrowser mode="admin" />
  </AdminShell>
</template>
