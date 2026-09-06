<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Ban, Check, CheckCircle2, ChevronRight, Clipboard, Download, Ellipsis, File, FileAudio, FileText, FileVideo, Folder, FolderInput, Grid2X2, Image, List, LoaderCircle, Search, SlidersHorizontal, Tags, Trash2, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import EmptyState from './EmptyState.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import FileActionsDialog from './FileActionsDialog.vue'
import TagAutocompleteInput from './TagAutocompleteInput.vue'
import { api } from '@/services/api'
import { copyText, formatBytes, formatDate } from '@/lib/utils'
import type { ChannelMap, FileListResponse, FileRecord } from '@/types/api'

const props = withDefaults(defineProps<{ mode?: 'admin' | 'public' }>(), { mode: 'admin' })
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const loading = ref(true)
const error = ref('')
const data = ref<FileListResponse>({ files: [], directories: [], totalCount: 0, returnedCount: 0 })
const search = ref('')
const type = ref('all')
const view = ref<'grid' | 'list'>('grid')
const selected = ref(new Set<string>())
const deleteOpen = ref(false)
const deleting = ref(false)
const actionsOpen = ref(false)
const activeFile = ref<FileRecord>()
const currentPage = ref(0)
const pageSize = 48
const channels = ref<ChannelMap>({})
const filtersOpen = ref(false)
const channelFilter = ref('all')
const channelNameFilter = ref('all')
const listTypeFilter = ref('all')
const accessFilter = ref('all')
const labelFilter = ref('all')
const fileTypeFilter = ref('all')
const includeTags = ref('')
const excludeTags = ref('')
const sort = ref<'dateDesc' | 'nameAsc'>('dateDesc')
const batchPanel = ref<'tags' | 'move'>()
const batchValue = ref('')
const batchTagAction = ref<'add' | 'remove'>('add')
const batchBusy = ref(false)
const listTypeOpen = ref(false)
const pendingListType = ref<'Block' | 'White'>('Block')

const currentDir = computed(() => {
  if (props.mode === 'admin') return typeof route.query.dir === 'string' ? route.query.dir : ''
  const value = route.params.dir
  return Array.isArray(value) ? value.join('/') : String(value || '')
})
const breadcrumbs = computed(() => currentDir.value.split('/').filter(Boolean))
const hasSelection = computed(() => selected.value.size > 0)
const hasActiveFilters = computed(() => [channelFilter.value, channelNameFilter.value, listTypeFilter.value, accessFilter.value, labelFilter.value, fileTypeFilter.value].some((value) => value !== 'all') || !!includeTags.value.trim() || !!excludeTags.value.trim())
const channelOptions = computed(() => {
  const values = new Map<string, string>()
  for (const [key, items] of Object.entries(channels.value)) {
    for (const item of items || []) values.set(item.type, key === 'cfr2' ? 'Cloudflare R2' : key === 'huggingface' ? 'Hugging Face' : key[0]!.toUpperCase() + key.slice(1))
  }
  return [...values.entries()].map(([value, label]) => ({ value, label }))
})
const channelNameOptions = computed(() => Object.entries(channels.value).flatMap(([, items]) => (items || []).map((item) => ({ value: `${item.type}:${item.name}`, label: item.name }))))
const displayedFiles = computed(() => [...data.value.files].sort((a, b) => {
  if (sort.value === 'nameAsc') return displayName(a).localeCompare(displayName(b), 'zh-CN')
  return Number(b.metadata?.TimeStamp || 0) - Number(a.metadata?.TimeStamp || 0)
}))

function encodePath(value: string) {
  return value.split('/').map(encodeURIComponent).join('/')
}

function fileUrl(file: FileRecord) {
  return `${window.location.origin}/file/${encodePath(file.name)}`
}

function isImage(file: FileRecord) {
  return file.metadata?.FileType?.startsWith('image/') || /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(file.name)
}

function fileIcon(file: FileRecord) {
  const mime = file.metadata?.FileType || ''
  if (isImage(file)) return Image
  if (mime.startsWith('video/')) return FileVideo
  if (mime.startsWith('audio/')) return FileAudio
  if (mime.startsWith('text/')) return FileText
  return File
}

function displayName(file: FileRecord) {
  return file.metadata?.FileName || file.name.split('/').pop() || file.name
}

async function load() {
  loading.value = true
  error.value = ''
  selected.value.clear()
  try {
    const params = {
      dir: currentDir.value,
      start: currentPage.value * pageSize,
      count: pageSize,
      search: search.value || undefined,
      type: props.mode === 'public' && type.value !== 'all' ? type.value : undefined,
      channel: props.mode === 'admin' && channelFilter.value !== 'all' ? channelFilter.value : undefined,
      channelName: props.mode === 'admin' && channelNameFilter.value !== 'all' ? channelNameFilter.value : undefined,
      listType: props.mode === 'admin' && listTypeFilter.value !== 'all' ? listTypeFilter.value : undefined,
      accessStatus: props.mode === 'admin' && accessFilter.value !== 'all' ? accessFilter.value : undefined,
      label: props.mode === 'admin' && labelFilter.value !== 'all' ? labelFilter.value : undefined,
      fileType: props.mode === 'admin' && fileTypeFilter.value !== 'all' ? fileTypeFilter.value : undefined,
      includeTags: props.mode === 'admin' ? includeTags.value.trim() || undefined : undefined,
      excludeTags: props.mode === 'admin' ? excludeTags.value.trim() || undefined : undefined,
    }
    data.value = props.mode === 'admin' ? await api.adminList(params) : await api.publicList(params)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : t('modern.files.loadFailed')
  } finally {
    loading.value = false
  }
}

function openDirectory(directory: string) {
  const cleaned = directory.replace(/^\/+|\/+$/g, '')
  router.push(props.mode === 'admin' ? { name: 'dashboardFiles', query: { dir: cleaned } } : { name: 'publicBrowse', params: { dir: cleaned } })
}

function goBreadcrumb(index: number) {
  const dir = breadcrumbs.value.slice(0, index + 1).join('/')
  openDirectory(dir)
}

function toggleSelect(name: string) {
  const next = new Set(selected.value)
  next.has(name) ? next.delete(name) : next.add(name)
  selected.value = next
}

async function copyLink(file: FileRecord) {
  await copyText(fileUrl(file))
  toast.success(t('modern.files.linkCopied'))
}

function openActions(file: FileRecord) {
  activeFile.value = file
  actionsOpen.value = true
}

async function confirmDelete() {
  deleting.value = true
  try {
    if (selected.value.size === 1) await api.deleteFile([...selected.value][0]!)
    else await api.batchDelete([...selected.value])
    toast.success(t('modern.files.deleted', { count: selected.value.size }))
    deleteOpen.value = false
    await load()
  } catch (reason) {
    toast.error(reason instanceof Error ? reason.message : t('modern.files.deleteFailed'))
  } finally {
    deleting.value = false
  }
}

function applyFilters() {
  currentPage.value = 0
  load()
}

function clearFilters() {
  channelFilter.value = channelNameFilter.value = listTypeFilter.value = accessFilter.value = labelFilter.value = fileTypeFilter.value = 'all'
  includeTags.value = ''
  excludeTags.value = ''
  applyFilters()
}

async function copySelected() {
  const links = data.value.files.filter((file) => selected.value.has(file.name)).map(fileUrl)
  await copyText(links.join('\n'))
  toast.success(t('modern.files.linksCopied', { count: links.length }))
}

async function downloadSelected() {
  batchBusy.value = true
  try {
    const { default: JSZip } = await import('jszip')
    const files = data.value.files.filter((file) => selected.value.has(file.name))
    const zip = new JSZip()
    const used = new Set<string>()
    await Promise.all(files.map(async (file) => {
      const response = await fetch(fileUrl(file), { credentials: 'include' })
      if (!response.ok) throw new Error(t('modern.files.downloadOneFailed', { name: displayName(file) }))
      let name = displayName(file)
      let suffix = 1
      while (used.has(name)) name = `${suffix++}-${displayName(file)}`
      used.add(name)
      zip.file(name, await response.blob())
    }))
    const blob = await zip.generateAsync({ type: 'blob' })
    const href = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = `imghub-files-${Date.now()}.zip`
    anchor.click()
    URL.revokeObjectURL(href)
    toast.success(t('modern.files.zipDone'))
  } catch (reason) {
    toast.error(reason instanceof Error ? reason.message : t('modern.files.batchDownloadFailed'))
  } finally {
    batchBusy.value = false
  }
}

function askListType(value: 'Block' | 'White') {
  pendingListType.value = value
  listTypeOpen.value = true
}

async function confirmListType() {
  batchBusy.value = true
  try {
    await api.batchSetListType([...selected.value], pendingListType.value)
    toast.success(t(pendingListType.value === 'Block' ? 'modern.files.batchBlocked' : 'modern.files.batchAllowed'))
    listTypeOpen.value = false
    await load()
  } catch (reason) {
    toast.error(reason instanceof Error ? reason.message : t('modern.files.batchListFailed'))
  } finally {
    batchBusy.value = false
  }
}

async function executeBatchPanel() {
  const value = batchValue.value.trim()
  if (!value) return toast.error(t(batchPanel.value === 'move' ? 'modern.files.needDestination' : 'modern.files.needTag'))
  batchBusy.value = true
  try {
    if (batchPanel.value === 'move') await api.batchMove([...selected.value], value.replace(/^\/+|\/+$/g, ''))
    else await api.batchTags([...selected.value], batchTagAction.value, [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))])
    toast.success(t(batchPanel.value === 'move' ? 'modern.files.moved' : batchTagAction.value === 'add' ? 'modern.files.tagsAdded' : 'modern.files.tagsRemoved'))
    batchPanel.value = undefined
    batchValue.value = ''
    await load()
  } catch (reason) {
    toast.error(reason instanceof Error ? reason.message : t('modern.files.batchFailed'))
  } finally {
    batchBusy.value = false
  }
}

let searchTimer: number | undefined
watch(search, () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    currentPage.value = 0
    load()
  }, 320)
})
watch(type, () => { currentPage.value = 0; load() })
watch(() => route.fullPath, () => {
  currentPage.value = 0
  load()
})
onMounted(() => {
  load()
  if (props.mode === 'admin') api.channels(true).then((value) => { channels.value = value }).catch(() => undefined)
})
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div class="flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
        <Button variant="ghost" size="sm" @click="openDirectory('')"><Folder /> {{ t('modern.files.root') }}</Button>
        <template v-for="(item, index) in breadcrumbs" :key="`${item}-${index}`">
          <ChevronRight class="size-4 shrink-0 text-muted-foreground" />
          <Button variant="ghost" size="sm" @click="goBreadcrumb(index)">{{ item }}</Button>
        </template>
      </div>
      <div class="flex flex-1 items-center gap-2 lg:justify-end">
        <div class="relative w-full max-w-sm">
          <Search class="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input v-model="search" class="pl-9" :placeholder="t('modern.files.search')" />
          <button v-if="search" class="absolute right-3 top-3" :aria-label="t('modern.files.clearSearch')" @click="search = ''"><X class="size-4 text-muted-foreground" /></button>
        </div>
        <Select v-if="mode === 'public'" v-model="type">
          <SelectTrigger class="w-32"><SelectValue :placeholder="t('modern.files.fileType')" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t('modern.files.allTypes') }}</SelectItem>
            <SelectItem value="image">{{ t('modern.files.image') }}</SelectItem>
            <SelectItem value="video">{{ t('modern.files.video') }}</SelectItem>
            <SelectItem value="audio">{{ t('modern.files.audio') }}</SelectItem>
            <SelectItem value="other">{{ t('modern.files.other') }}</SelectItem>
          </SelectContent>
        </Select>
        <Button v-if="mode === 'admin'" :variant="filtersOpen || hasActiveFilters ? 'secondary' : 'outline'" size="icon" :aria-label="t('modern.files.advancedFilters')" @click="filtersOpen = !filtersOpen"><SlidersHorizontal /></Button>
        <Select v-model="sort">
          <SelectTrigger class="w-32"><SelectValue :placeholder="t('modern.files.sort')" /></SelectTrigger>
          <SelectContent><SelectItem value="dateDesc">{{ t('modern.files.latest') }}</SelectItem><SelectItem value="nameAsc">{{ t('modern.files.nameSort') }}</SelectItem></SelectContent>
        </Select>
        <div class="flex rounded-lg border p-0.5">
          <Button :variant="view === 'grid' ? 'secondary' : 'ghost'" size="icon" class="size-8" :aria-label="t('modern.files.grid')" @click="view = 'grid'"><Grid2X2 /></Button>
          <Button :variant="view === 'list' ? 'secondary' : 'ghost'" size="icon" class="size-8" :aria-label="t('modern.files.list')" @click="view = 'list'"><List /></Button>
        </div>
      </div>
    </div>

    <Card v-if="mode === 'admin' && filtersOpen" class="p-4 shadow-none">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div class="space-y-1.5"><p class="text-xs text-muted-foreground">{{ t('modern.files.storageType') }}</p><Select v-model="channelFilter"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{{ t('modern.files.allTypes') }}</SelectItem><SelectItem v-for="item in channelOptions" :key="item.value" :value="item.value">{{ item.label }}</SelectItem></SelectContent></Select></div>
        <div class="space-y-1.5"><p class="text-xs text-muted-foreground">{{ t('modern.files.channelName') }}</p><Select v-model="channelNameFilter"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{{ t('modern.files.allChannels') }}</SelectItem><SelectItem v-for="item in channelNameOptions" :key="item.value" :value="item.value">{{ item.label }}</SelectItem></SelectContent></Select></div>
        <div class="space-y-1.5"><p class="text-xs text-muted-foreground">{{ t('modern.files.accessList') }}</p><Select v-model="listTypeFilter"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{{ t('modern.files.allStatuses') }}</SelectItem><SelectItem value="White">{{ t('modern.files.allowList') }}</SelectItem><SelectItem value="Block">{{ t('modern.files.blockList') }}</SelectItem><SelectItem value="None">{{ t('modern.files.unset') }}</SelectItem></SelectContent></Select></div>
        <div class="space-y-1.5"><p class="text-xs text-muted-foreground">{{ t('modern.files.accessStatus') }}</p><Select v-model="accessFilter"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{{ t('modern.files.allStatuses') }}</SelectItem><SelectItem value="normal">{{ t('modern.files.normal') }}</SelectItem><SelectItem value="blocked">{{ t('modern.files.blocked') }}</SelectItem></SelectContent></Select></div>
        <div class="space-y-1.5"><p class="text-xs text-muted-foreground">{{ t('modern.files.moderation') }}</p><Select v-model="labelFilter"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{{ t('modern.files.allResults') }}</SelectItem><SelectItem value="normal">{{ t('modern.files.normal') }}</SelectItem><SelectItem value="teen">{{ t('modern.files.sensitive') }}</SelectItem><SelectItem value="adult">{{ t('modern.files.adult') }}</SelectItem></SelectContent></Select></div>
        <div class="space-y-1.5"><p class="text-xs text-muted-foreground">{{ t('modern.files.fileType') }}</p><Select v-model="fileTypeFilter"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{{ t('modern.files.allFiles') }}</SelectItem><SelectItem value="image">{{ t('modern.files.image') }}</SelectItem><SelectItem value="video">{{ t('modern.files.video') }}</SelectItem><SelectItem value="audio">{{ t('modern.files.audio') }}</SelectItem><SelectItem value="other">{{ t('modern.files.other') }}</SelectItem></SelectContent></Select></div>
      </div>
      <div class="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><Input v-model="includeTags" :placeholder="t('modern.files.includeTags')" /><Input v-model="excludeTags" :placeholder="t('modern.files.excludeTags')" /><div class="flex gap-2"><Button variant="ghost" :disabled="!hasActiveFilters" @click="clearFilters">{{ t('modern.files.clear') }}</Button><Button @click="applyFilters">{{ t('modern.files.apply') }}</Button></div></div>
    </Card>

    <div v-if="mode === 'admin' && hasSelection" class="flex items-center justify-between rounded-xl border bg-card p-3 shadow-sm">
      <div class="min-w-0"><p class="pl-1 text-sm">{{ t('modern.files.selected', { count: selected.size }) }}</p><div v-if="batchPanel" class="mt-2 flex max-w-2xl flex-wrap gap-2"><Input v-if="batchPanel === 'move'" v-model="batchValue" class="h-9 min-w-64 flex-1" :placeholder="t('modern.files.destination')" @keyup.enter="executeBatchPanel" /><template v-else><Select v-model="batchTagAction"><SelectTrigger class="h-9 w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="add">{{ t('modern.files.addTags') }}</SelectItem><SelectItem value="remove">{{ t('modern.files.removeTags') }}</SelectItem></SelectContent></Select><TagAutocompleteInput v-model="batchValue" class="min-w-64 flex-1" :placeholder="t('modern.files.tagsPlaceholder')" /></template><Button size="sm" :disabled="batchBusy" @click="executeBatchPanel"><LoaderCircle v-if="batchBusy" class="animate-spin" />{{ t('modern.files.execute') }}</Button></div></div>
      <div class="flex flex-wrap justify-end gap-1"><Button variant="ghost" size="sm" :disabled="batchBusy" @click="copySelected"><Clipboard />{{ t('modern.files.copy') }}</Button><Button variant="ghost" size="sm" :disabled="batchBusy" @click="downloadSelected"><Download />{{ t('modern.files.download') }}</Button><Button variant="ghost" size="sm" @click="batchPanel = batchPanel === 'tags' ? undefined : 'tags'; batchValue = ''"><Tags />{{ t('modern.files.tags') }}</Button><Button variant="ghost" size="sm" @click="batchPanel = batchPanel === 'move' ? undefined : 'move'; batchValue = ''"><FolderInput />{{ t('modern.files.move') }}</Button><Button variant="ghost" size="sm" @click="askListType('White')"><CheckCircle2 />{{ t('modern.files.allowList') }}</Button><Button variant="ghost" size="sm" @click="askListType('Block')"><Ban />{{ t('modern.files.blockList') }}</Button><Button variant="ghost" size="sm" @click="selected = new Set(); batchPanel = undefined">{{ t('modern.files.cancel') }}</Button><Button variant="destructive" size="sm" @click="deleteOpen = true"><Trash2 />{{ t('modern.files.delete') }}</Button></div>
    </div>

    <div v-if="loading" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      <Skeleton v-for="index in 12" :key="index" class="aspect-square rounded-xl" />
    </div>
    <EmptyState v-else-if="error" :title="t('modern.files.loadTitle')" :description="error"><Button variant="outline" @click="load">{{ t('modern.files.reload') }}</Button></EmptyState>
    <EmptyState v-else-if="!data.files.length && !data.directories.length" :title="t('modern.files.emptyTitle')" :description="t('modern.files.emptyDescription')" />

    <template v-else>
      <div v-if="data.directories.length" class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <button v-for="directory in data.directories" :key="directory" class="focus-ring flex items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" @click="openDirectory(directory)">
          <span class="grid size-10 place-items-center rounded-lg bg-amber-500/12 text-amber-700 dark:text-amber-400"><Folder class="size-5" /></span>
          <span class="min-w-0 truncate text-sm font-medium">{{ directory.split('/').filter(Boolean).pop() }}</span>
        </button>
      </div>

      <div v-if="view === 'grid'" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <Card v-for="file in displayedFiles" :key="file.name" class="group overflow-hidden shadow-none transition hover:shadow-md" :class="selected.has(file.name) && 'ring-2 ring-primary'">
          <div class="relative aspect-square overflow-hidden bg-muted">
            <img v-if="isImage(file)" :src="fileUrl(file)" :alt="displayName(file)" loading="lazy" class="size-full object-cover transition duration-300 group-hover:scale-[1.025]" />
            <component :is="fileIcon(file)" v-else class="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
            <button v-if="mode === 'admin'" class="absolute left-2 top-2 grid size-7 place-items-center rounded-lg border bg-background/90 shadow-sm" :aria-label="t(selected.has(file.name) ? 'modern.files.unselect' : 'modern.files.selectFile')" @click="toggleSelect(file.name)">
              <span class="grid size-4 place-items-center rounded border" :class="selected.has(file.name) && 'border-primary bg-primary text-primary-foreground'"><Check v-if="selected.has(file.name)" class="size-3" /></span>
            </button>
            <Button variant="secondary" size="icon" class="absolute bottom-2 right-2 size-8 opacity-0 shadow-sm transition group-hover:opacity-100 focus:opacity-100" @click="copyLink(file)"><Clipboard /></Button>
            <Button v-if="mode === 'admin'" variant="secondary" size="icon" class="absolute bottom-2 left-2 size-8 opacity-0 shadow-sm transition group-hover:opacity-100 focus:opacity-100" @click="openActions(file)"><Ellipsis /></Button>
          </div>
          <div class="p-3">
            <a :href="fileUrl(file)" target="_blank" class="block truncate text-sm font-medium hover:underline">{{ displayName(file) }}</a>
            <p class="mt-1 truncate text-xs text-muted-foreground">{{ file.metadata?.FileSizeBytes ? formatBytes(file.metadata.FileSizeBytes) : (file.metadata?.FileSize ? `${file.metadata.FileSize} MB` : t('modern.files.unknownSize')) }}</p>
          </div>
        </Card>
      </div>

      <div v-else class="overflow-hidden rounded-xl border bg-card">
        <div v-for="file in displayedFiles" :key="file.name" class="flex items-center gap-3 border-b p-3 last:border-b-0 hover:bg-muted/40">
          <button v-if="mode === 'admin'" class="grid size-7 place-items-center" @click="toggleSelect(file.name)"><span class="grid size-4 place-items-center rounded border" :class="selected.has(file.name) && 'border-primary bg-primary text-primary-foreground'"><Check v-if="selected.has(file.name)" class="size-3" /></span></button>
          <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><component :is="fileIcon(file)" class="size-4" /></span>
          <div class="min-w-0 flex-1"><a :href="fileUrl(file)" target="_blank" class="block truncate text-sm font-medium hover:underline">{{ displayName(file) }}</a><p class="text-xs text-muted-foreground">{{ formatDate(file.metadata?.TimeStamp) }}</p></div>
          <Badge variant="outline" class="hidden sm:inline-flex">{{ file.metadata?.Channel || t('modern.files.file') }}</Badge>
          <Button variant="ghost" size="icon" @click="copyLink(file)"><Clipboard /></Button>
          <Button v-if="mode === 'admin'" variant="ghost" size="icon" @click="openActions(file)"><Ellipsis /></Button>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <p class="text-xs text-muted-foreground">{{ t('modern.files.total', { count: data.totalCount }) }}</p>
        <div class="flex gap-2"><Button variant="outline" size="sm" :disabled="currentPage === 0" @click="currentPage--; load()">{{ t('modern.files.previous') }}</Button><Button variant="outline" size="sm" :disabled="(currentPage + 1) * pageSize >= data.totalCount" @click="currentPage++; load()">{{ t('modern.files.next') }}</Button></div>
      </div>
    </template>

    <ConfirmDialog v-model:open="deleteOpen" :title="t('modern.files.deleteTitle')" :description="t('modern.files.deleteDescription', { count: selected.size })" :confirm-text="t('modern.files.deleteForever')" :busy="deleting" @confirm="confirmDelete" />
    <ConfirmDialog v-model:open="listTypeOpen" :title="t(pendingListType === 'Block' ? 'modern.files.blockTitle' : 'modern.files.allowTitle')" :description="t('modern.files.listDescription', { count: selected.size })" :confirm-text="t(pendingListType === 'Block' ? 'modern.files.addBlock' : 'modern.files.addAllow')" :busy="batchBusy" @confirm="confirmListType" />
    <FileActionsDialog v-if="mode === 'admin'" v-model:open="actionsOpen" :file="activeFile" :url="activeFile ? fileUrl(activeFile) : undefined" @changed="load" />
  </section>
</template>
