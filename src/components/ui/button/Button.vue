<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  class?: HTMLAttributes['class']
}>(), {
  variant: 'default',
  size: 'default',
  type: 'button',
})

const classes = computed(() => cn(
  'focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4',
  {
    'bg-primary text-primary-foreground shadow-sm hover:brightness-95': props.variant === 'default',
    'bg-secondary text-secondary-foreground hover:bg-accent': props.variant === 'secondary',
    'border bg-background hover:bg-accent hover:text-accent-foreground': props.variant === 'outline',
    'hover:bg-accent hover:text-accent-foreground': props.variant === 'ghost',
    'bg-destructive text-destructive-foreground hover:brightness-95': props.variant === 'destructive',
    'h-10 px-4 py-2': props.size === 'default',
    'h-8 rounded-md px-3 text-xs': props.size === 'sm',
    'h-11 px-6': props.size === 'lg',
    'size-10 p-0': props.size === 'icon',
  },
  props.class,
))
</script>

<template>
  <button :type="type" :disabled="disabled" :class="classes">
    <slot />
  </button>
</template>
