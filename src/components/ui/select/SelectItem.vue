<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Check } from '@lucide/vue'
import { SelectItem, SelectItemIndicator, SelectItemText } from 'reka-ui'
import { cn } from '@/lib/utils'

defineProps<{ value: string | number; disabled?: boolean; class?: HTMLAttributes['class'] }>()
</script>

<template>
  <SelectItem
    :value="value"
    :disabled="disabled"
    :class="cn('focus:bg-accent focus:text-accent-foreground relative flex w-full select-none items-center rounded-md py-1.5 pr-8 pl-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50', $props.class)"
  >
    <span class="absolute right-2 flex size-4 items-center justify-center">
      <SelectItemIndicator><Check class="size-4" /></SelectItemIndicator>
    </span>
    <SelectItemText><slot /></SelectItemText>
  </SelectItem>
</template>
