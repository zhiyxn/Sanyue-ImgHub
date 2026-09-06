<script setup lang="ts">
withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg'; showName?: boolean; name?: string; src?: string }>(), {
  size: 'md',
  showName: true,
  name: 'ImgHub',
})
</script>

<template>
  <span class="inline-flex items-center gap-2.5">
    <img
      v-if="src"
      :src="src"
      alt=""
      class="shrink-0 rounded-lg object-contain"
      :class="{ 'size-7': size === 'sm', 'size-9': size === 'md', 'size-12': size === 'lg' }"
    />
    <svg
      v-else
      :class="{ 'size-7': size === 'sm', 'size-9': size === 'md', 'size-12': size === 'lg' }"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="17" class="fill-stone-900 dark:fill-stone-100" />
      <path d="M17 20.5A3.5 3.5 0 0 1 20.5 17h23a3.5 3.5 0 0 1 3.5 3.5v23a3.5 3.5 0 0 1-3.5 3.5h-23a3.5 3.5 0 0 1-3.5-3.5v-23Z" class="stroke-stone-50 dark:stroke-stone-900" stroke-width="3" />
      <circle cx="25" cy="26" r="3" class="fill-amber-500" />
      <path d="m20 42 8.5-9 5.5 5 4.5-4.5L44 42H20Z" class="fill-amber-500" />
      <path d="M37 16v13m0-13-5 5m5-5 5 5" class="stroke-stone-50 dark:stroke-stone-900" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span v-if="showName" class="text-[15px] font-semibold tracking-tight">{{ name }}</span>
  </span>
</template>
