<script setup lang="ts">
import { computed } from 'vue'
import { Ban, Home, ShieldAlert, SearchX } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import BrandMark from '@/components/modern/BrandMark.vue'

const props = defineProps<{ kind: 'blocked' | 'whitelist' | 'not-found' }>()
const content = computed(() => ({
  blocked: { code: '403', title: '内容不可访问', description: '这个文件已被管理员限制访问。', icon: Ban },
  whitelist: { code: '403', title: '访问受限', description: '当前网络地址不在允许访问的名单中。', icon: ShieldAlert },
  'not-found': { code: '404', title: '页面不存在', description: '链接可能已失效，或页面已被移动。', icon: SearchX },
}[props.kind]))
</script>
<template>
  <div class="relative grid min-h-screen place-items-center overflow-hidden px-4">
    <div class="surface-grid absolute inset-0" />
    <div class="relative max-w-md text-center">
      <div class="mb-8 flex justify-center"><BrandMark /></div>
      <div class="mx-auto mb-5 grid size-14 place-items-center rounded-2xl border bg-card shadow-sm"><component :is="content.icon" class="size-6 text-muted-foreground" /></div>
      <p class="font-mono text-sm font-semibold text-primary">{{ content.code }}</p>
      <h1 class="mt-2 text-3xl font-semibold tracking-tight">{{ content.title }}</h1>
      <p class="mt-3 text-sm leading-6 text-muted-foreground">{{ content.description }}</p>
      <Button class="mt-7" @click="$router.push('/')"><Home /> 返回首页</Button>
    </div>
  </div>
</template>
