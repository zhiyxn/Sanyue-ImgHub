<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { TabsList } from 'reka-ui'
import { cn } from '@/lib/utils'

defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template><TabsList :class="cn('inline-flex h-11 items-center rounded-xl border bg-muted/35 p-1 text-muted-foreground', $props.class)"><slot /></TabsList></template>
