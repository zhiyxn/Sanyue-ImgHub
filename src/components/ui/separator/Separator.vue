<script setup lang="ts">withDefaults(defineProps<{ orientation?: 'horizontal' | 'vertical' }>(), { orientation: 'horizontal' })</script>
<template><div :class="orientation === 'horizontal' ? 'h-px w-full bg-border' : 'h-full w-px bg-border'" /></template>
