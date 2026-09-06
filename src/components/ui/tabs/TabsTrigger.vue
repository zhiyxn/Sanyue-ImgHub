<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { TabsTrigger } from 'reka-ui'
import { cn } from '@/lib/utils'

defineProps<{ value: string; class?: HTMLAttributes['class']; disabled?: boolean }>()
</script>

<template>
  <TabsTrigger
    :value="value"
    :disabled="disabled"
    :class="cn('focus-ring inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm disabled:pointer-events-none disabled:opacity-50', $props.class)"
  >
    <slot />
  </TabsTrigger>
</template>
