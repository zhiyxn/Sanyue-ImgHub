<script setup lang="ts">
import AppShell from '@/components/modern/AppShell.vue'
import FileBrowser from '@/components/modern/FileBrowser.vue'
import PageHeading from '@/components/modern/PageHeading.vue'
</script>
<template>
  <AppShell>
    <div class="mb-7"><PageHeading eyebrow="Public Library" title="公开文件" description="浏览站点所有者允许公开访问的内容。" /></div>
    <FileBrowser mode="public" />
  </AppShell>
</template>
