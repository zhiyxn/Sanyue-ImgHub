<script setup lang="ts">
import { cn } from '@/lib/utils'
const props = withDefaults(defineProps<{ variant?: 'default' | 'destructive'; class?: string }>(), { variant: 'default' })
</script>
<template><div role="alert" :class="cn('rounded-lg border p-4 text-sm', variant === 'destructive' && 'border-destructive/35 bg-destructive/5 text-destructive', $props.class)"><slot /></div></template>
