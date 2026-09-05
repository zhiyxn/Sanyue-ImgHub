<script setup lang="ts">
import { cn } from '@/lib/utils'
const props = withDefaults(defineProps<{ variant?: 'default' | 'secondary' | 'outline' | 'success' | 'destructive'; class?: string }>(), { variant: 'default' })
</script>
<template><span :class="cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', { 'border-transparent bg-primary text-primary-foreground': variant === 'default', 'border-transparent bg-secondary text-secondary-foreground': variant === 'secondary', 'bg-background': variant === 'outline', 'border-transparent bg-emerald-500/12 text-emerald-700 dark:text-emerald-400': variant === 'success', 'border-transparent bg-destructive/12 text-destructive': variant === 'destructive' }, $props.class)"><slot /></span></template>
