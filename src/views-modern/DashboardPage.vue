<script setup lang="ts">
import AppShell from '@/components/modern/AppShell.vue'
import FileBrowser from '@/components/modern/FileBrowser.vue'
import PageHeading from '@/components/modern/PageHeading.vue'
</script>
<template>
  <AppShell admin>
    <div class="mb-7"><PageHeading eyebrow="Library" title="文件管理" description="查看、搜索、复制和删除存储中的文件。" /></div>
    <FileBrowser mode="admin" />
  </AppShell>
</template>
