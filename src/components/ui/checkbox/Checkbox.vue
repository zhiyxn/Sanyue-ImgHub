<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Check } from '@lucide/vue'
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'
import { cn } from '@/lib/utils'

defineProps<{ class?: HTMLAttributes['class']; id?: string; disabled?: boolean }>()
const model = defineModel<boolean>({ default: false })
</script>

<template>
  <CheckboxRoot
    v-model="model"
    :id="id"
    :disabled="disabled"
    :class="cn('focus-ring peer size-4 shrink-0 rounded border bg-background shadow-xs data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50', $props.class)"
  >
    <CheckboxIndicator class="grid place-items-center text-current">
      <Check class="size-3.5" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
