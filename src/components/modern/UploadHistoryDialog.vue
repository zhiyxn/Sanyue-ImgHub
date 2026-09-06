<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { Clipboard, ExternalLink, History, Trash2, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import ConfirmDialog from './ConfirmDialog.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { copyText } from '@/lib/utils'

export interface UploadHistoryItem { name: string; url: string; time: number }

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const { t, locale } = useI18n()
const items = ref<UploadHistoryItem[]>([])
const visibleCount = ref(30)
const clearOpen = ref(false)

const visibleItems = computed(() => items.value.slice(0, visibleCount.value))
const groups = computed(() => {
  const grouped = new Map<string, UploadHistoryItem[]>()
  for (const item of visibleItems.value) {
    const day = new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(item.time))
    grouped.set(day, [...(grouped.get(day) || []), item])
  }
  return [...grouped.entries()].map(([date, records]) => ({ date, records }))
})

watch(() => props.open, (open) => {
  if (!open) return
  visibleCount.value = 30
  load()
})

function load() {
  try {
    const value = JSON.parse(localStorage.getItem('uploadHistory') || '[]') as UploadHistoryItem[]
    items.value = value.filter((item) => item?.name && item?.url && item?.time).sort((a, b) => b.time - a.time)
  } catch { items.value = [] }
}

function persist() {
  localStorage.setItem('uploadHistory', JSON.stringify(items.value))
}

async function copy(url: string) {
  await copyText(url)
  toast.success(t('modern.uploadHistory.copied'))
}

function remove(item: UploadHistoryItem) {
  items.value = items.value.filter((record) => record !== item)
  persist()
}

function clearAll() {
  items.value = []
  persist()
  clearOpen.value = false
  toast.success(t('modern.uploadHistory.cleared'))
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value))
}
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
      <DialogContent class="fixed right-0 top-0 z-50 h-full w-full max-w-2xl overflow-y-auto border-l bg-background p-6 shadow-2xl sm:p-7">
        <div class="flex items-start justify-between gap-4">
          <div><DialogTitle class="flex items-center gap-2 text-xl font-semibold"><History class="size-5 text-primary" />{{ t('modern.uploadHistory.title') }}</DialogTitle><DialogDescription class="mt-1 text-sm text-muted-foreground">{{ t('modern.uploadHistory.description', { count: items.length }) }}</DialogDescription></div>
          <div class="flex gap-1"><Button v-if="items.length" variant="ghost" size="icon" :aria-label="t('modern.uploadHistory.clear')" @click="clearOpen = true"><Trash2 /></Button><DialogClose as-child><Button variant="ghost" size="icon" :aria-label="t('modern.uploadHistory.close')"><X /></Button></DialogClose></div>
        </div>

        <div v-if="groups.length" class="mt-7 space-y-7">
          <section v-for="group in groups" :key="group.date">
            <p class="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{{ group.date }}</p>
            <div class="space-y-2">
              <Card v-for="item in group.records" :key="`${item.time}-${item.url}`" class="flex items-center gap-3 p-3 shadow-none">
                <img :src="item.url" alt="" class="size-12 rounded-lg border bg-muted object-cover" loading="lazy" />
                <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium">{{ item.name }}</p><p class="mt-0.5 truncate text-xs text-muted-foreground">{{ item.url }}</p><p class="mt-1 text-[11px] text-muted-foreground">{{ formatTime(item.time) }}</p></div>
                <div class="flex shrink-0"><Button variant="ghost" size="icon" :aria-label="t('modern.uploadHistory.copy')" @click="copy(item.url)"><Clipboard /></Button><Button variant="ghost" size="icon" as-child><a :href="item.url" target="_blank" rel="noopener" :aria-label="t('modern.uploadHistory.open')"><ExternalLink /></a></Button><Button variant="ghost" size="icon" class="text-destructive hover:text-destructive" :aria-label="t('modern.uploadHistory.remove')" @click="remove(item)"><Trash2 /></Button></div>
              </Card>
            </div>
          </section>
          <Button v-if="visibleCount < items.length" variant="outline" class="w-full" @click="visibleCount += 30">{{ t('modern.uploadHistory.loadMore') }}</Button>
        </div>
        <div v-else class="mt-16 grid place-items-center text-center"><span class="grid size-12 place-items-center rounded-xl bg-muted"><History class="size-5 text-muted-foreground" /></span><p class="mt-4 font-medium">{{ t('modern.uploadHistory.empty') }}</p><p class="mt-1 text-sm text-muted-foreground">{{ t('modern.uploadHistory.emptyHint') }}</p></div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
  <ConfirmDialog v-model:open="clearOpen" :title="t('modern.uploadHistory.clearTitle')" :description="t('modern.uploadHistory.clearDescription')" :confirm-text="t('modern.uploadHistory.clear')" @confirm="clearAll" />
</template>
