<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ArrowRight, ShieldCheck, Zap } from '@lucide/vue'
import AppShell from '@/components/modern/AppShell.vue'
import FileUploader from '@/components/modern/FileUploader.vue'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/stores/app'
import { useI18n } from 'vue-i18n'

const store = useAppStore()
const { t } = useI18n()
</script>

<template>
  <AppShell>
    <section class="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Badge variant="outline" class="mb-4 gap-1.5"><Zap class="size-3" /> {{ t('modern.home.badge') }}</Badge>
        <h1 class="max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">
          {{ t('modern.home.titleBefore') }}<span class="text-primary">{{ t('modern.home.titleAccent') }}</span>
        </h1>
        <p class="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{{ store.config.announcement ? String(store.config.announcement).replace(/<[^>]*>/g, '') : t('modern.home.description') }}</p>
      </div>
      <RouterLink to="/browse" class="focus-ring group inline-flex shrink-0 items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium">{{ t('modern.home.browse') }} <ArrowRight class="size-4 transition-transform group-hover:translate-x-0.5" /></RouterLink>
    </section>

    <FileUploader />

    <section class="mt-14 grid gap-4 border-t pt-8 sm:grid-cols-3">
      <div class="flex gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><Zap class="size-4" /></span><div><h2 class="text-sm font-medium">{{ t('modern.home.directTitle') }}</h2><p class="mt-1 text-xs leading-5 text-muted-foreground">{{ t('modern.home.directDescription') }}</p></div></div>
      <div class="flex gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><ShieldCheck class="size-4" /></span><div><h2 class="text-sm font-medium">{{ t('modern.home.authTitle') }}</h2><p class="mt-1 text-xs leading-5 text-muted-foreground">{{ t('modern.home.authDescription') }}</p></div></div>
      <div class="flex gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><ArrowRight class="size-4" /></span><div><h2 class="text-sm font-medium">{{ t('modern.home.storageTitle') }}</h2><p class="mt-1 text-xs leading-5 text-muted-foreground">{{ t('modern.home.storageDescription') }}</p></div></div>
    </section>
  </AppShell>
</template>
