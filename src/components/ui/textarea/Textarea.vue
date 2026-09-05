<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useVModel } from '@vueuse/core'
import { cn } from '@/lib/utils'
const props = defineProps<{ modelValue?: string; placeholder?: string; rows?: number; disabled?: boolean; class?: HTMLAttributes['class'] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const model = useVModel(props, 'modelValue', emit, { passive: true, defaultValue: '' })
</script>
<template><textarea v-model="model" :placeholder="placeholder" :rows="rows || 4" :disabled="disabled" :class="cn('focus-ring flex min-h-20 w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground disabled:opacity-50', $props.class)" /></template>
