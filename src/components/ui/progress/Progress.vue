<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{ modelValue?: number }>(), { modelValue: 0 })
const width = computed(() => `${Math.min(100, Math.max(0, props.modelValue))}%`)
</script>
<template><div class="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary"><div class="h-full bg-primary transition-all" :style="{ width }" /></div></template>
