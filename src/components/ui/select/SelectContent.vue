<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ChevronDown, ChevronUp } from '@lucide/vue'
import {
  SelectContent,
  SelectPortal,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectViewport,
} from 'reka-ui'
import { cn } from '@/lib/utils'

defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <SelectPortal>
    <SelectContent
      position="popper"
      :side-offset="4"
      :class="cn('relative z-50 max-h-80 min-w-[var(--reka-select-trigger-width)] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out', $props.class)"
    >
      <SelectScrollUpButton class="flex h-7 items-center justify-center bg-popover">
        <ChevronUp class="size-4" />
      </SelectScrollUpButton>
      <SelectViewport class="w-full p-1">
        <slot />
      </SelectViewport>
      <SelectScrollDownButton class="flex h-7 items-center justify-center bg-popover">
        <ChevronDown class="size-4" />
      </SelectScrollDownButton>
    </SelectContent>
  </SelectPortal>
</template>
