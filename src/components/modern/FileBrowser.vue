<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Check, ChevronRight, Clipboard, Ellipsis, File, FileAudio, FileText, FileVideo, Folder, Grid2X2, Image, List, Search, Trash2, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from './EmptyState.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import FileActionsDialog from './FileActionsDialog.vue'
import { api } from '@/services/api'
import { copyText, formatBytes, formatDate } from '@/lib/utils'
import type { FileListResponse, FileRecord } from '@/types/api'

const props = withDefaults(defineProps<{ mode?: 'admin' | 'public' }>(), { mode: 'admin' })
const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref('')
const data = ref<FileListResponse>({ files: [], directories: [], totalCount: 0, returnedCount: 0 })
const search = ref('')
const type = ref('')
const view = ref<'grid' | 'list'>('grid')
const selected = ref(new Set<string>())
const deleteOpen = ref(false)
const deleting = ref(false)
const actionsOpen = ref(false)
const activeFile = ref<FileRecord>()
const currentPage = ref(0)
const pageSize = 48

const currentDir = computed(() => {
  if (props.mode === 'admin') return typeof route.query.dir === 'string' ? route.query.dir : ''
  const value = route.params.dir
  return Array.isArray(value) ? value.join('/') : String(value || '')
})
const breadcrumbs = computed(() => currentDir.value.split('/').filter(Boolean))
const hasSelection = computed(() => selected.value.size > 0)

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
      type: props.mode === 'public' ? type.value || undefined : undefined,
    }
    data.value = props.mode === 'admin' ? await api.adminList(params) : await api.publicList(params)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '无法读取文件列表'
  } finally {
    loading.value = false
  }
}

function openDirectory(directory: string) {
  const cleaned = directory.replace(/^\/+|\/+$/g, '')
  router.push(props.mode === 'admin' ? { name: 'dashboard', query: { dir: cleaned } } : { name: 'publicBrowse', params: { dir: cleaned } })
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
  toast.success('文件链接已复制')
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
    toast.success(`已删除 ${selected.value.size} 个文件`)
    deleteOpen.value = false
    await load()
  } catch (reason) {
    toast.error(reason instanceof Error ? reason.message : '删除失败')
  } finally {
    deleting.value = false
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
onMounted(load)
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div class="flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
        <Button variant="ghost" size="sm" @click="openDirectory('')"><Folder /> 根目录</Button>
        <template v-for="(item, index) in breadcrumbs" :key="`${item}-${index}`">
          <ChevronRight class="size-4 shrink-0 text-muted-foreground" />
          <Button variant="ghost" size="sm" @click="goBreadcrumb(index)">{{ item }}</Button>
        </template>
      </div>
      <div class="flex flex-1 items-center gap-2 lg:justify-end">
        <div class="relative w-full max-w-sm">
          <Search class="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input v-model="search" class="pl-9" placeholder="搜索文件…" />
          <button v-if="search" class="absolute right-3 top-3" aria-label="清除搜索" @click="search = ''"><X class="size-4 text-muted-foreground" /></button>
        </div>
        <select v-if="mode === 'public'" v-model="type" class="focus-ring h-10 rounded-lg border bg-background px-3 text-sm">
          <option value="">全部类型</option><option value="image">图片</option><option value="video">视频</option><option value="audio">音频</option><option value="other">其他</option>
        </select>
        <div class="flex rounded-lg border p-0.5">
          <Button :variant="view === 'grid' ? 'secondary' : 'ghost'" size="icon" class="size-8" aria-label="网格" @click="view = 'grid'"><Grid2X2 /></Button>
          <Button :variant="view === 'list' ? 'secondary' : 'ghost'" size="icon" class="size-8" aria-label="列表" @click="view = 'list'"><List /></Button>
        </div>
      </div>
    </div>

    <div v-if="mode === 'admin' && hasSelection" class="flex items-center justify-between rounded-xl border bg-card p-3 shadow-sm">
      <p class="pl-1 text-sm">已选择 <strong>{{ selected.size }}</strong> 项</p>
      <div class="flex gap-2"><Button variant="ghost" size="sm" @click="selected = new Set()">取消选择</Button><Button variant="destructive" size="sm" @click="deleteOpen = true"><Trash2 /> 删除</Button></div>
    </div>

    <div v-if="loading" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      <Skeleton v-for="index in 12" :key="index" class="aspect-square rounded-xl" />
    </div>
    <EmptyState v-else-if="error" title="无法读取文件" :description="error"><Button variant="outline" @click="load">重新加载</Button></EmptyState>
    <EmptyState v-else-if="!data.files.length && !data.directories.length" title="这里还没有文件" description="上传文件或进入其他目录后，内容会显示在这里。" />

    <template v-else>
      <div v-if="data.directories.length" class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <button v-for="directory in data.directories" :key="directory" class="focus-ring flex items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" @click="openDirectory(directory)">
          <span class="grid size-10 place-items-center rounded-lg bg-amber-500/12 text-amber-700 dark:text-amber-400"><Folder class="size-5" /></span>
          <span class="min-w-0 truncate text-sm font-medium">{{ directory.split('/').filter(Boolean).pop() }}</span>
        </button>
      </div>

      <div v-if="view === 'grid'" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <Card v-for="file in data.files" :key="file.name" class="group overflow-hidden shadow-none transition hover:shadow-md" :class="selected.has(file.name) && 'ring-2 ring-primary'">
          <div class="relative aspect-square overflow-hidden bg-muted">
            <img v-if="isImage(file)" :src="fileUrl(file)" :alt="displayName(file)" loading="lazy" class="size-full object-cover transition duration-300 group-hover:scale-[1.025]" />
            <component :is="fileIcon(file)" v-else class="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
            <button v-if="mode === 'admin'" class="absolute left-2 top-2 grid size-7 place-items-center rounded-lg border bg-background/90 shadow-sm" :aria-label="selected.has(file.name) ? '取消选择' : '选择文件'" @click="toggleSelect(file.name)">
              <span class="grid size-4 place-items-center rounded border" :class="selected.has(file.name) && 'border-primary bg-primary text-primary-foreground'"><Check v-if="selected.has(file.name)" class="size-3" /></span>
            </button>
            <Button variant="secondary" size="icon" class="absolute bottom-2 right-2 size-8 opacity-0 shadow-sm transition group-hover:opacity-100 focus:opacity-100" @click="copyLink(file)"><Clipboard /></Button>
            <Button v-if="mode === 'admin'" variant="secondary" size="icon" class="absolute bottom-2 left-2 size-8 opacity-0 shadow-sm transition group-hover:opacity-100 focus:opacity-100" @click="openActions(file)"><Ellipsis /></Button>
          </div>
          <div class="p-3">
            <a :href="fileUrl(file)" target="_blank" class="block truncate text-sm font-medium hover:underline">{{ displayName(file) }}</a>
            <p class="mt-1 truncate text-xs text-muted-foreground">{{ file.metadata?.FileSizeBytes ? formatBytes(file.metadata.FileSizeBytes) : (file.metadata?.FileSize ? `${file.metadata.FileSize} MB` : '未知大小') }}</p>
          </div>
        </Card>
      </div>

      <div v-else class="overflow-hidden rounded-xl border bg-card">
        <div v-for="file in data.files" :key="file.name" class="flex items-center gap-3 border-b p-3 last:border-b-0 hover:bg-muted/40">
          <button v-if="mode === 'admin'" class="grid size-7 place-items-center" @click="toggleSelect(file.name)"><span class="grid size-4 place-items-center rounded border" :class="selected.has(file.name) && 'border-primary bg-primary text-primary-foreground'"><Check v-if="selected.has(file.name)" class="size-3" /></span></button>
          <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><component :is="fileIcon(file)" class="size-4" /></span>
          <div class="min-w-0 flex-1"><a :href="fileUrl(file)" target="_blank" class="block truncate text-sm font-medium hover:underline">{{ displayName(file) }}</a><p class="text-xs text-muted-foreground">{{ formatDate(file.metadata?.TimeStamp) }}</p></div>
          <Badge variant="outline" class="hidden sm:inline-flex">{{ file.metadata?.Channel || '文件' }}</Badge>
          <Button variant="ghost" size="icon" @click="copyLink(file)"><Clipboard /></Button>
          <Button v-if="mode === 'admin'" variant="ghost" size="icon" @click="openActions(file)"><Ellipsis /></Button>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <p class="text-xs text-muted-foreground">共 {{ data.totalCount }} 个文件</p>
        <div class="flex gap-2"><Button variant="outline" size="sm" :disabled="currentPage === 0" @click="currentPage--; load()">上一页</Button><Button variant="outline" size="sm" :disabled="(currentPage + 1) * pageSize >= data.totalCount" @click="currentPage++; load()">下一页</Button></div>
      </div>
    </template>

    <ConfirmDialog v-model:open="deleteOpen" title="删除所选文件？" :description="`将永久删除 ${selected.size} 个文件及其存储对象，此操作无法撤销。`" confirm-text="永久删除" :busy="deleting" @confirm="confirmDelete" />
    <FileActionsDialog v-if="mode === 'admin'" v-model:open="actionsOpen" :file="activeFile" :url="activeFile ? fileUrl(activeFile) : undefined" @changed="load" />
  </section>
</template>
