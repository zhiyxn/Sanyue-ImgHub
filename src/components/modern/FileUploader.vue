<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, ChevronDown, Clipboard, File, Folder, LoaderCircle, RotateCcw, Trash2, UploadCloud, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { api } from '@/services/api'
import { useAppStore } from '@/stores/app'
import { copyText, formatBytes } from '@/lib/utils'
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
}

const store = useAppStore()
const input = ref<HTMLInputElement>()
const dragging = ref(false)
const channels = ref<ChannelMap>({})
const channel = ref<UploadChannelType>(store.config.defaultUploadChannel || 'cfr2')
const channelName = ref(store.config.defaultChannelName || '')
const folder = ref(store.config.defaultUploadFolder || '')
const autoRetry = ref(true)
const uploadNameType = ref(store.config.defaultUploadNameType || 'default')
const expanded = ref(false)
const tasks = ref<UploadTask[]>([])
const running = ref(false)
const controllers = new Map<string, AbortController>()

const channelLabels: Record<UploadChannelType, string> = {
  telegram: 'Telegram',
  cfr2: 'Cloudflare R2',
  s3: 'S3',
  discord: 'Discord',
  huggingface: 'Hugging Face',
  webdav: 'WebDAV',
  external: '外链',
}

const availableChannels = computed(() =>
  (Object.keys(channels.value) as UploadChannelType[]).filter((key) => channels.value[key]?.length),
)
const channelNames = computed(() => channels.value[channel.value] || [])
const completedCount = computed(() => tasks.value.filter((task) => task.status === 'done').length)

onMounted(async () => {
  try {
    channels.value = await api.channels()
    if (!channels.value[channel.value]?.length) channel.value = availableChannels.value[0] || 'cfr2'
    channelName.value = channelNames.value.find((item) => item.name === channelName.value)?.name || channelNames.value[0]?.name || ''
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '无法读取上传渠道')
  }
})

onBeforeUnmount(() => {
  tasks.value.forEach((task) => task.preview && URL.revokeObjectURL(task.preview))
  controllers.forEach((controller) => controller.abort())
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

function removeTask(task: UploadTask) {
  controllers.get(task.id)?.abort()
  if (task.preview) URL.revokeObjectURL(task.preview)
  tasks.value = tasks.value.filter((item) => item.id !== task.id)
}

async function uploadOne(task: UploadTask) {
  const controller = new AbortController()
  controllers.set(task.id, controller)
  task.status = 'uploading'
  task.error = undefined
  task.progress = 0
  try {
    const result = await api.upload(task.file, {
      channel: channel.value,
      channelName: channelName.value,
      folder: folder.value.replace(/^\/+|\/+$/g, ''),
      autoRetry: autoRetry.value,
      uploadNameType: uploadNameType.value,
      returnFormat: 'full',
      signal: controller.signal,
      onProgress: (progress) => (task.progress = progress),
    })
    const uploaded = result[0]
    if (!uploaded) throw new Error('服务器未返回文件地址')
    task.result = uploaded.publicUrl || uploaded.src
    task.progress = 100
    task.status = 'done'
  } catch (error) {
    if (controller.signal.aborted) return
    task.status = 'error'
    task.error = error instanceof Error ? error.message : '上传失败'
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
  if (failed) toast.error(`${failed} 个文件上传失败`)
  else toast.success('全部上传完成')
}

async function copyResult(task: UploadTask) {
  if (!task.result) return
  await copyText(task.result)
  toast.success('链接已复制')
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
          <span class="text-lg font-semibold tracking-tight">拖入文件，或点击选择</span>
          <span class="mt-2 max-w-md text-sm leading-6 text-muted-foreground">支持图片、视频及任意文件，可一次选择多个文件并并发上传。</span>
          <span class="mt-5 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">最多同时上传 3 个文件</span>
        </button>
        <input ref="input" type="file" multiple class="sr-only" @change="$event.target && addFiles(($event.target as HTMLInputElement).files || [])" />
      </Card>

      <div v-if="tasks.length" class="space-y-2">
        <div class="flex items-center justify-between px-1">
          <p class="text-sm font-medium">上传队列 <span class="text-muted-foreground">{{ completedCount }}/{{ tasks.length }}</span></p>
          <Button variant="ghost" size="sm" :disabled="running" @click="tasks = []"><Trash2 /> 清空</Button>
        </div>
        <Card v-for="task in tasks" :key="task.id" class="p-3 shadow-none">
          <div class="flex items-center gap-3">
            <img v-if="task.preview" :src="task.preview" alt="" class="size-12 rounded-lg border object-cover" />
            <div v-else class="grid size-12 shrink-0 place-items-center rounded-lg bg-muted"><File class="size-5 text-muted-foreground" /></div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="truncate text-sm font-medium">{{ task.file.name }}</p>
                <Badge v-if="task.status === 'done'" variant="success"><Check class="mr-1 size-3" />完成</Badge>
                <Badge v-else-if="task.status === 'error'" variant="destructive">失败</Badge>
              </div>
              <p class="mt-0.5 text-xs text-muted-foreground">{{ formatBytes(task.file.size) }}<span v-if="task.error"> · {{ task.error }}</span></p>
              <Progress v-if="task.status === 'uploading'" :model-value="task.progress" class="mt-2" />
              <button v-if="task.result" class="mt-1 max-w-full truncate text-left text-xs text-primary hover:underline" @click="copyResult(task)">{{ task.result }}</button>
            </div>
            <Button v-if="task.result" variant="ghost" size="icon" aria-label="复制链接" @click="copyResult(task)"><Clipboard /></Button>
            <Button v-if="task.status === 'error'" variant="ghost" size="icon" aria-label="重试" @click="task.status = 'queued'; startUpload()"><RotateCcw /></Button>
            <Button variant="ghost" size="icon" aria-label="移除" @click="removeTask(task)"><X /></Button>
          </div>
        </Card>
      </div>
    </div>

    <aside class="space-y-4">
      <Card class="p-5 shadow-none">
        <div class="mb-5">
          <h2 class="font-semibold">上传设置</h2>
          <p class="mt-1 text-xs text-muted-foreground">设置将应用到本次队列。</p>
        </div>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="channel">存储渠道</Label>
            <div class="relative">
              <select id="channel" v-model="channel" class="focus-ring h-10 w-full appearance-none rounded-lg border bg-background px-3 pr-9 text-sm" @change="channelName = channelNames[0]?.name || ''">
                <option v-for="item in availableChannels" :key="item" :value="item">{{ channelLabels[item] }}</option>
              </select>
              <ChevronDown class="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground" />
            </div>
          </div>
          <div v-if="channelNames.length > 1" class="space-y-2">
            <Label for="channelName">渠道名称</Label>
            <select id="channelName" v-model="channelName" class="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm">
              <option v-for="item in channelNames" :key="item.name" :value="item.name">{{ item.name }}</option>
            </select>
          </div>
          <div class="space-y-2">
            <Label for="folder">上传目录</Label>
            <div class="relative"><Folder class="absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="folder" v-model="folder" class="pl-9" placeholder="例如 images/2026" /></div>
          </div>
          <button type="button" class="flex w-full items-center justify-between py-1 text-sm" @click="expanded = !expanded">
            <span>更多选项</span><ChevronDown class="size-4 transition-transform" :class="expanded && 'rotate-180'" />
          </button>
          <div v-if="expanded" class="space-y-4 border-t pt-4">
            <div class="space-y-2">
              <Label for="nameType">文件命名</Label>
              <select id="nameType" v-model="uploadNameType" class="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm">
                <option value="default">默认</option><option value="index">仅前缀</option><option value="origin">保留原名</option><option value="short">短链接</option>
              </select>
            </div>
            <div class="flex items-center justify-between gap-4">
              <div><p class="text-sm font-medium">失败自动换线</p><p class="text-xs text-muted-foreground">当前渠道失败时尝试备用渠道</p></div>
              <Switch v-model="autoRetry" />
            </div>
          </div>
        </div>
      </Card>

      <Button size="lg" class="w-full" :disabled="!tasks.length || running" @click="startUpload">
        <LoaderCircle v-if="running" class="animate-spin" /><UploadCloud v-else />
        {{ running ? '正在上传' : `上传 ${tasks.filter((item) => item.status !== 'done').length} 个文件` }}
      </Button>
      <p class="px-2 text-center text-xs leading-5 text-muted-foreground">文件直接发送到你的 Cloudflare 部署，不经过第三方前端服务。</p>
    </aside>
  </div>
</template>
