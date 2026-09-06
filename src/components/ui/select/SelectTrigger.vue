<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ChevronDown } from '@lucide/vue'
import { SelectIcon, SelectTrigger } from 'reka-ui'
import { cn } from '@/lib/utils'

defineProps<{ class?: HTMLAttributes['class']; id?: string; disabled?: boolean }>()
</script>

<template>
  <SelectTrigger
    :id="id"
    :disabled="disabled"
    :class="cn('focus-ring flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-sm shadow-xs data-[placeholder]:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 [&>span]:truncate', $props.class)"
  >
    <slot />
    <SelectIcon as-child>
      <ChevronDown class="size-4 shrink-0 text-muted-foreground" />
    </SelectIcon>
  </SelectTrigger>
</template>
