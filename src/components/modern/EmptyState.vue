<script setup lang="ts">
import { Images } from '@lucide/vue'
defineProps<{ title: string; description?: string }>()
</script>
<template>
  <div class="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/25 p-8 text-center">
    <div class="mb-4 grid size-11 place-items-center rounded-xl border bg-background"><Images class="size-5 text-muted-foreground" /></div>
    <h3 class="font-medium">{{ title }}</h3>
    <p v-if="description" class="mt-1 max-w-sm text-sm text-muted-foreground">{{ description }}</p>
    <div class="mt-4"><slot /></div>
  </div>
</template>
