<script setup lang="ts">defineProps<{ title: string; description?: string; eyebrow?: string }>()</script>
<template>
  <div class="flex flex-col gap-1">
    <p v-if="eyebrow" class="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{{ eyebrow }}</p>
    <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">{{ title }}</h1>
    <p v-if="description" class="max-w-2xl text-sm leading-6 text-muted-foreground">{{ description }}</p>
  </div>
</template>
