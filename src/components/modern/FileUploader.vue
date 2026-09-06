<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, ChevronDown, Clipboard, ClipboardPaste, File as FileIcon, History, Link2, LoaderCircle, RotateCcw, Trash2, UploadCloud, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/services/api'
import { useAppStore } from '@/stores/app'
import { copyText, formatBytes } from '@/lib/utils'
import { formatUploadedLink, processImageForUpload } from '@/lib/upload-processing'
import UploadHistoryDialog, { type UploadHistoryItem } from './UploadHistoryDialog.vue'
import DirectoryAutocompleteInput from './DirectoryAutocompleteInput.vue'
import type { LinkFormat } from '@/lib/upload-processing'
import type { ChannelMap, UploadChannelType } from '@/types/api'

type UploadStatus = 'queued' | 'uploading' | 'done' | 'error'
interface UploadTask {
  id: string
  file: File
  preview?: string
  progress: number
  status: UploadStatus
  result?: string
  error?: string
  originalSize?: number
  processedSize?: number
  externalUrl?: string
}

interface UploadPreferences {
  channel?: UploadChannelType
  channelName?: string
  folder?: string
  autoRetry?: boolean
  uploadNameType?: 'default' | 'index' | 'origin' | 'short'
  compressImages?: boolean
  compressThreshold?: number
  compressTarget?: number
  convertToWebp?: boolean
  serverCompress?: boolean
  linkFormat?: LinkFormat
}

function loadPreferences(): UploadPreferences {
  try { return JSON.parse(localStorage.getItem('imghub-upload-preferences') || '{}') as UploadPreferences } catch { return {} }
}

const store = useAppStore()
const { t } = useI18n()
const preferences = loadPreferences()
const input = ref<HTMLInputElement>()
const dragging = ref(false)
const channels = ref<ChannelMap>({})
const channel = ref<UploadChannelType>(preferences.channel || store.config.defaultUploadChannel || 'cfr2')
const channelName = ref(preferences.channelName || store.config.defaultChannelName || '')
const folder = ref(preferences.folder ?? store.config.defaultUploadFolder ?? '')
const autoRetry = ref(preferences.autoRetry ?? true)
const uploadNameType = ref(preferences.uploadNameType || store.config.defaultUploadNameType || 'default')
const compressImages = ref(preferences.compressImages ?? Boolean(store.config.defaultCustomerCompress ?? true))
const compressThreshold = ref(preferences.compressThreshold ?? Number(store.config.defaultCompressBar || 5))
const compressTarget = ref(preferences.compressTarget ?? Number(store.config.defaultCompressQuality || 4))
const convertToWebp = ref(preferences.convertToWebp ?? Boolean(store.config.defaultConvertToWebp ?? false))
const serverCompress = ref(preferences.serverCompress ?? true)
const linkFormat = ref<LinkFormat>(preferences.linkFormat || (store.config.defaultUploadCopyUrlForm as LinkFormat) || 'url')
const urlMode = ref<'save' | 'external'>('save')
const pastedUrls = ref('')
const fetchingUrls = ref(false)
const expanded = ref(false)
const tasks = ref<UploadTask[]>([])
const running = ref(false)
const historyOpen = ref(false)
const controllers = new Map<string, AbortController>()

const channelLabels = computed<Record<UploadChannelType, string>>(() => ({
  telegram: 'Telegram',
  cfr2: 'Cloudflare R2',
  s3: 'S3',
  discord: 'Discord',
  huggingface: 'Hugging Face',
  webdav: 'WebDAV',
  external: t('modern.upload.external'),
}))

const availableChannels = computed(() =>
  (Object.keys(channels.value) as UploadChannelType[]).filter((key) => channels.value[key]?.length),
)
const channelNames = computed(() => channels.value[channel.value] || [])
const completedCount = computed(() => tasks.value.filter((task) => task.status === 'done').length)

function changeChannel(value: string | number | undefined) {
  channel.value = value as UploadChannelType
  channelName.value = channelNames.value[0]?.name || ''
}

onMounted(async () => {
  document.addEventListener('paste', onPaste)
  try {
    channels.value = await api.channels()
    if (!channels.value[channel.value]?.length) channel.value = availableChannels.value[0] || 'cfr2'
    channelName.value = channelNames.value.find((item) => item.name === channelName.value)?.name || channelNames.value[0]?.name || ''
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('modern.upload.channelLoadFailed'))
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('paste', onPaste)
  tasks.value.forEach((task) => task.preview && URL.revokeObjectURL(task.preview))
  controllers.forEach((controller) => controller.abort())
})

watch([channel, channelName, folder, autoRetry, uploadNameType, compressImages, compressThreshold, compressTarget, convertToWebp, serverCompress, linkFormat], () => {
  const value: UploadPreferences = {
    channel: channel.value, channelName: channelName.value, folder: folder.value, autoRetry: autoRetry.value,
    uploadNameType: uploadNameType.value, compressImages: compressImages.value, compressThreshold: Number(compressThreshold.value),
    compressTarget: Number(compressTarget.value), convertToWebp: convertToWebp.value, serverCompress: serverCompress.value, linkFormat: linkFormat.value,
  }
  localStorage.setItem('imghub-upload-preferences', JSON.stringify(value))
})

function addFiles(fileList: FileList | File[]) {
  const known = new Set(tasks.value.map((task) => `${task.file.name}:${task.file.size}:${task.file.lastModified}`))
  for (const file of Array.from(fileList)) {
    const signature = `${file.name}:${file.size}:${file.lastModified}`
    if (known.has(signature)) continue
    tasks.value.push({
      id: crypto.randomUUID(),
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      progress: 0,
      status: 'queued',
    })
  }
}

function onDrop(event: DragEvent) {
  dragging.value = false
  if (event.dataTransfer?.files) addFiles(event.dataTransfer.files)
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

function onPaste(event: ClipboardEvent) {
  if (isEditableTarget(event.target)) return
  const files = Array.from(event.clipboardData?.files || [])
  if (files.length) {
    event.preventDefault()
    addFiles(files)
    toast.success(t('modern.upload.clipboardAdded', { count: files.length }))
    return
  }
  const text = event.clipboardData?.getData('text/plain')?.trim()
  if (text && /^https?:\/\/\S+$/i.test(text)) {
    event.preventDefault()
    pastedUrls.value = text
    addRemoteUrls()
  }
}

function filenameFromRemote(url: string, disposition: string) {
  const encoded = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1]
  const regular = disposition.match(/filename[^;=]*=([^;]+)/i)?.[1]?.replace(/["']/g, '')
  const candidate = encoded ? decodeURIComponent(encoded) : regular
  if (candidate) return candidate
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || '') || `RemoteFile-${Date.now()}` } catch { return `RemoteFile-${Date.now()}` }
}

async function addRemoteUrls() {
  const urls = pastedUrls.value.split(/\r?\n/).map((item) => item.trim()).filter((item) => /^https?:\/\/\S+$/i.test(item))
  if (!urls.length) return toast.error(t('modern.upload.invalidUrls'))
  fetchingUrls.value = true
  let added = 0
  for (const url of urls) {
    try {
      if (urlMode.value === 'external') {
        const name = filenameFromRemote(url, '')
        tasks.value.push({ id: crypto.randomUUID(), file: new File([], name, { type: 'text/plain' }), progress: 0, status: 'queued', externalUrl: url })
        added += 1
        continue
      }
      const { blob, disposition } = await api.fetchRemoteResource(url)
      addFiles([new File([blob], filenameFromRemote(url, disposition), { type: blob.type || 'application/octet-stream' })])
      added += 1
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : t('modern.upload.urlLoadFailed', { url }))
    }
  }
  fetchingUrls.value = false
  if (added) {
    pastedUrls.value = ''
    toast.success(t('modern.upload.urlAdded', { count: added }))
  }
}

function removeTask(task: UploadTask) {
  controllers.get(task.id)?.abort()
  if (task.preview) URL.revokeObjectURL(task.preview)
  tasks.value = tasks.value.filter((item) => item.id !== task.id)
}

function recordHistory(task: UploadTask) {
  if (!task.result) return
  let history: UploadHistoryItem[] = []
  try { history = JSON.parse(localStorage.getItem('uploadHistory') || '[]') as UploadHistoryItem[] } catch { history = [] }
  history.unshift({ name: task.file.name, url: task.result, time: Date.now() })
  localStorage.setItem('uploadHistory', JSON.stringify(history.slice(0, 500)))
}

async function uploadOne(task: UploadTask) {
  const controller = new AbortController()
  controllers.set(task.id, controller)
  task.status = 'uploading'
  task.error = undefined
  task.progress = 0
  try {
    if (task.externalUrl) {
      const result = await api.upload(task.file, {
        channel: 'external',
        folder: folder.value.replace(/^\/+|\/+$/g, ''),
        autoRetry: false,
        uploadNameType: 'default',
        returnFormat: 'full',
        externalUrl: task.externalUrl,
        serverCompress: false,
        signal: controller.signal,
        onProgress: (progress) => (task.progress = progress),
      })
      const uploaded = result[0]
      task.result = uploaded?.publicUrl || uploaded?.src || task.externalUrl
      task.progress = 100
      task.status = 'done'
      recordHistory(task)
      return
    }
    const uploadFile = await processImageForUpload(task.file, {
      compress: compressImages.value,
      thresholdMB: Number(compressThreshold.value),
      targetMB: Number(compressTarget.value),
      convertToWebp: convertToWebp.value,
    })
    task.originalSize = task.file.size
    task.processedSize = uploadFile.size
    const result = await api.upload(uploadFile, {
      channel: channel.value,
      channelName: channelName.value,
      folder: folder.value.replace(/^\/+|\/+$/g, ''),
      autoRetry: autoRetry.value,
      uploadNameType: uploadNameType.value,
      serverCompress: channel.value === 'telegram' ? serverCompress.value : false,
      returnFormat: 'full',
      signal: controller.signal,
      onProgress: (progress) => (task.progress = progress),
    })
    const uploaded = result[0]
    if (!uploaded) throw new Error(t('modern.upload.emptyResponse'))
    task.result = uploaded.publicUrl || uploaded.src
    task.progress = 100
    task.status = 'done'
    recordHistory(task)
  } catch (error) {
    if (controller.signal.aborted) return
    task.status = 'error'
    task.error = error instanceof Error ? error.message : t('modern.upload.uploadFailed')
  } finally {
    controllers.delete(task.id)
  }
}

async function startUpload() {
  const queue = tasks.value.filter((task) => task.status === 'queued' || task.status === 'error')
  if (!queue.length) return
  running.value = true
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length) {
      const task = queue.shift()
      if (task) await uploadOne(task)
    }
  })
  await Promise.all(workers)
  running.value = false
  const failed = tasks.value.filter((task) => task.status === 'error').length
  if (failed) toast.error(t('modern.upload.filesFailed', { count: failed }))
  else toast.success(t('modern.upload.allDone'))
}

async function copyResult(task: UploadTask) {
  if (!task.result) return
  await copyText(formatUploadedLink(task.result, task.file.name, linkFormat.value))
  toast.success(t('modern.upload.linkCopied'))
}

async function copyAllResults() {
  const completed = tasks.value.filter((task) => task.result)
  await copyText(completed.map((task) => formatUploadedLink(task.result!, task.file.name, linkFormat.value)).join('\n'))
  toast.success(t('modern.upload.linksCopied', { count: completed.length }))
}
</script>

<template>
  <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
    <div class="space-y-4">
      <Card
        class="group relative overflow-hidden border-dashed shadow-none transition-colors"
        :class="dragging && 'border-primary bg-primary/5'"
        @dragenter.prevent="dragging = true"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <div class="surface-grid pointer-events-none absolute inset-0 opacity-45" />
        <button type="button" class="relative flex min-h-72 w-full flex-col items-center justify-center p-8 text-center" @click="input?.click()">
          <span class="mb-5 grid size-14 place-items-center rounded-2xl bg-stone-900 text-stone-50 shadow-sm transition-transform group-hover:-translate-y-0.5 dark:bg-stone-100 dark:text-stone-900">
            <UploadCloud class="size-6" />
          </span>
          <span class="text-lg font-semibold tracking-tight">{{ t('modern.upload.dropTitle') }}</span>
          <span class="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{{ t('modern.upload.dropDescription') }}</span>
          <span class="mt-5 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">{{ t('modern.upload.concurrency') }}</span>
        </button>
        <input ref="input" type="file" multiple class="sr-only" @change="$event.target && addFiles(($event.target as HTMLInputElement).files || [])" />
      </Card>

      <Card class="p-4 shadow-none">
        <div class="mb-3 flex items-center gap-3"><span class="grid size-9 place-items-center rounded-lg bg-muted"><Link2 class="size-4" /></span><div><p class="text-sm font-medium">{{ t('modern.upload.urlTitle') }}</p><p class="text-xs text-muted-foreground">{{ t('modern.upload.urlDescription') }}</p></div></div>
        <div class="mb-3 grid grid-cols-2 rounded-lg border bg-muted/30 p-1 text-sm"><button type="button" class="rounded-md px-3 py-2 transition" :class="urlMode === 'save' ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'" @click="urlMode = 'save'">{{ t('modern.upload.downloadUpload') }}</button><button type="button" class="rounded-md px-3 py-2 transition" :class="urlMode === 'external' ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'" @click="urlMode = 'external'">{{ t('modern.upload.externalOnly') }}</button></div>
        <Textarea v-model="pastedUrls" :rows="3" placeholder="https://example.com/image.jpg" />
        <div class="mt-3 flex items-center justify-between gap-3"><p class="flex items-center gap-1.5 text-xs text-muted-foreground"><ClipboardPaste class="size-3.5" />{{ t(urlMode === 'external' ? 'modern.upload.externalHint' : 'modern.upload.pasteHint') }}</p><Button variant="outline" size="sm" :disabled="fetchingUrls || !pastedUrls.trim()" @click="addRemoteUrls"><LoaderCircle v-if="fetchingUrls" class="animate-spin" /><Link2 v-else />{{ t('modern.upload.addQueue') }}</Button></div>
      </Card>

      <div v-if="tasks.length" class="space-y-2">
        <div class="flex items-center justify-between px-1">
          <p class="text-sm font-medium">{{ t('modern.upload.queue') }} <span class="text-muted-foreground">{{ completedCount }}/{{ tasks.length }}</span></p>
          <div class="flex gap-1"><Button v-if="completedCount" variant="ghost" size="sm" @click="copyAllResults"><Clipboard />{{ t('modern.upload.copyAll') }}</Button><Button variant="ghost" size="sm" :disabled="running" @click="tasks = []"><Trash2 /> {{ t('modern.upload.clear') }}</Button></div>
        </div>
        <Card v-for="task in tasks" :key="task.id" class="p-3 shadow-none">
          <div class="flex items-center gap-3">
            <img v-if="task.preview" :src="task.preview" alt="" class="size-12 rounded-lg border object-cover" />
            <div v-else class="grid size-12 shrink-0 place-items-center rounded-lg bg-muted"><FileIcon class="size-5 text-muted-foreground" /></div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="truncate text-sm font-medium">{{ task.file.name }}</p><Badge v-if="task.externalUrl" variant="outline">{{ t('modern.upload.external') }}</Badge>
                <Badge v-if="task.status === 'done'" variant="success"><Check class="mr-1 size-3" />{{ t('modern.upload.done') }}</Badge>
                <Badge v-else-if="task.status === 'error'" variant="destructive">{{ t('modern.upload.failed') }}</Badge>
              </div>
              <p class="mt-0.5 text-xs text-muted-foreground">{{ formatBytes(task.file.size) }}<span v-if="task.processedSize && task.originalSize && task.processedSize < task.originalSize"> → {{ formatBytes(task.processedSize) }}</span><span v-if="task.error"> · {{ task.error }}</span></p>
              <Progress v-if="task.status === 'uploading'" :model-value="task.progress" class="mt-2" />
              <button v-if="task.result" class="mt-1 max-w-full truncate text-left text-xs text-primary hover:underline" @click="copyResult(task)">{{ task.result }}</button>
            </div>
            <Button v-if="task.result" variant="ghost" size="icon" :aria-label="t('modern.upload.copyLink')" @click="copyResult(task)"><Clipboard /></Button>
            <Button v-if="task.status === 'error'" variant="ghost" size="icon" :aria-label="t('modern.upload.retry')" @click="task.status = 'queued'; startUpload()"><RotateCcw /></Button>
            <Button variant="ghost" size="icon" :aria-label="t('modern.upload.remove')" @click="removeTask(task)"><X /></Button>
          </div>
        </Card>
      </div>
    </div>

    <aside class="space-y-4">
      <Button variant="outline" class="w-full justify-start" @click="historyOpen = true"><History />{{ t('modern.uploadHistory.title') }}</Button>
      <Card class="p-5 shadow-none">
        <div class="mb-5">
          <h2 class="font-semibold">{{ t('modern.upload.settings') }}</h2>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('modern.upload.settingsHint') }}</p>
        </div>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="channel">{{ t('modern.upload.channel') }}</Label>
            <Select :model-value="channel" @update:model-value="changeChannel">
              <SelectTrigger id="channel"><SelectValue :placeholder="t('modern.upload.chooseChannel')" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="item in availableChannels" :key="item" :value="item">{{ channelLabels[item] }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-if="channelNames.length > 1" class="space-y-2">
            <Label for="channelName">{{ t('modern.upload.channelName') }}</Label>
            <Select v-model="channelName">
              <SelectTrigger id="channelName"><SelectValue :placeholder="t('modern.upload.chooseChannelName')" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="item in channelNames" :key="item.name" :value="item.name">{{ item.name }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="folder">{{ t('modern.upload.folder') }}</Label>
            <DirectoryAutocompleteInput v-model="folder" :placeholder="t('modern.upload.folderPlaceholder')" />
          </div>
          <div class="space-y-2">
            <Label for="link-format">{{ t('modern.upload.linkFormat') }}</Label>
            <Select v-model="linkFormat"><SelectTrigger id="link-format"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="url">{{ t('modern.upload.originalLink') }}</SelectItem><SelectItem value="md">Markdown</SelectItem><SelectItem value="html">HTML</SelectItem><SelectItem value="ubb">BBCode</SelectItem></SelectContent></Select>
          </div>
          <button type="button" class="flex w-full items-center justify-between py-1 text-sm" @click="expanded = !expanded">
            <span>{{ t('modern.upload.more') }}</span><ChevronDown class="size-4 transition-transform" :class="expanded && 'rotate-180'" />
          </button>
          <div v-if="expanded" class="space-y-4 border-t pt-4">
            <div class="space-y-2">
              <Label for="nameType">{{ t('modern.upload.fileName') }}</Label>
              <Select v-model="uploadNameType">
                <SelectTrigger id="nameType"><SelectValue :placeholder="t('modern.upload.chooseNaming')" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{{ t('modern.upload.defaultName') }}</SelectItem>
                  <SelectItem value="index">{{ t('modern.upload.prefixName') }}</SelectItem>
                  <SelectItem value="origin">{{ t('modern.upload.originalName') }}</SelectItem>
                  <SelectItem value="short">{{ t('modern.upload.shortName') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex items-center justify-between gap-4">
              <div><p class="text-sm font-medium">{{ t('modern.upload.autoRetry') }}</p><p class="text-xs text-muted-foreground">{{ t('modern.upload.autoRetryHint') }}</p></div>
              <Switch v-model="autoRetry" />
            </div>
            <div class="flex items-center justify-between gap-4"><div><p class="text-sm font-medium">{{ t('modern.upload.webp') }}</p><p class="text-xs text-muted-foreground">{{ t('modern.upload.webpHint') }}</p></div><Switch v-model="convertToWebp" /></div>
            <div class="flex items-center justify-between gap-4"><div><p class="text-sm font-medium">{{ t('modern.upload.compress') }}</p><p class="text-xs text-muted-foreground">{{ t('modern.upload.compressHint') }}</p></div><Switch v-model="compressImages" /></div>
            <div v-if="compressImages" class="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3"><div class="space-y-2"><Label for="compress-threshold">{{ t('modern.upload.threshold') }}</Label><Input id="compress-threshold" v-model="compressThreshold" type="number" min="0.5" max="20" step="0.5" /></div><div class="space-y-2"><Label for="compress-target">{{ t('modern.upload.target') }}</Label><Input id="compress-target" v-model="compressTarget" type="number" min="0.1" :max="compressThreshold" step="0.1" /></div></div>
            <div v-if="channel === 'telegram'" class="flex items-center justify-between gap-4"><div><p class="text-sm font-medium">{{ t('modern.upload.telegramCompress') }}</p><p class="text-xs text-muted-foreground">{{ t('modern.upload.telegramCompressHint') }}</p></div><Switch v-model="serverCompress" /></div>
          </div>
        </div>
      </Card>

      <Button size="lg" class="w-full" :disabled="!tasks.length || running" @click="startUpload">
        <LoaderCircle v-if="running" class="animate-spin" /><UploadCloud v-else />
        {{ running ? t('modern.upload.uploading') : t('modern.upload.uploadCount', { count: tasks.filter((item) => item.status !== 'done').length }) }}
      </Button>
      <p class="px-2 text-center text-xs leading-5 text-muted-foreground">{{ t('modern.upload.directHint') }}</p>
    </aside>
  </div>
  <UploadHistoryDialog v-model:open="historyOpen" />
</template>
