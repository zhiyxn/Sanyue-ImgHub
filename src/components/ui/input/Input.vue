<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useVModel } from '@vueuse/core'
import { cn } from '@/lib/utils'
const props = defineProps<{ modelValue?: string | number; type?: string; placeholder?: string; disabled?: boolean; autocomplete?: string; class?: HTMLAttributes['class'] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const model = useVModel(props, 'modelValue', emit, { passive: true, defaultValue: '' })
</script>
<template><input v-model="model" :type="type || 'text'" :placeholder="placeholder" :disabled="disabled" :autocomplete="autocomplete" :class="cn('focus-ring flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground disabled:opacity-50', $props.class)" /></template>
