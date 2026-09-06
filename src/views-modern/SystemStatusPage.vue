<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  Activity,
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  Clock3,
  Database,
  FileClock,
  HardDrive,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
  X,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import AdminShell from '@/components/modern/AdminShell.vue'
import PageHeading from '@/components/modern/PageHeading.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/services/api'
import IndexRebuilder from '@/utils/indexRebuilder.js'
import BackupGenerator from '@/utils/backupGenerator.js'
import RestoreProcessor from '@/utils/restoreProcessor.js'
import packageInfo from '../../package.json'

interface FileRecord {
  id: string
  metadata?: {
    FileName?: string
    FileType?: string
    TimeStamp?: number | string
    Channel?: string
    ChannelName?: string
  }
}

interface TrendSeries {
  name?: string
  data?: number[]
  isOther?: boolean
}

interface IndexInfo {
  success?: boolean
  totalFiles?: number
  lastUpdated?: number | string
  channelStats?: Record<string, number>
  typeStats?: Record<string, number>
  uploadTrend?: {
    labels?: string[]
    total?: number[]
    groupBy?: Record<string, { series?: TrendSeries[] }>
  }
  newestFile?: FileRecord
  oldestFile?: FileRecord
}

interface IndexStorage {
  success?: boolean
  isChunked?: boolean
  totalChunks?: number
  existingChunks?: number
  totalSize?: number
  chunks?: Array<{ chunkId: number; exists: boolean; size: number }>
  metadata?: { totalCount?: number; lastOperationId?: string; lastUpdated?: number }
}

interface QuotaChannel {
  usedMB?: number
  fileCount?: number
}

interface QuotaStats {
  success?: boolean
  totalSizeMB?: number
  totalCount?: number
  quotaStats?: Record<string, QuotaChannel>
}

interface ProcessProgress {
  phase: string
  message: string
  current: number
  total: number
  percentage: number
}

interface TaskError extends Error {
  code?: string
  suggestion?: string
  recoverable?: boolean
}

const loading = ref(true)
const loadError = ref('')
const now = ref(new Date())
const trendGroupBy = ref<'channel' | 'channelName'>('channel')
const info = ref<IndexInfo>({})
const storage = ref<IndexStorage>({})
const quota = ref<QuotaStats>({})
const restoreInput = ref<HTMLInputElement>()

const processing = ref(false)
const processKind = ref<'rebuild' | 'backup' | 'restore' | ''>('')
const progress = ref<ProcessProgress>({ phase: '', message: '', current: 0, total: 0, percentage: 0 })
const processError = ref<{ message: string; suggestion?: string }>()
let activeTask: { abort: () => void } | undefined
let clockTimer: number | undefined

const indexedFiles = computed(() => Number(info.value.totalFiles || quota.value.totalCount || 0))
const channelCount = computed(() => Object.keys(info.value.channelStats || {}).length)
const isHealthy = computed(() => !loadError.value && info.value.success !== false)
const greeting = computed(() => {
  const hour = now.value.getHours()
  if (hour < 5) return '夜深了，系统仍在运行'
  if (hour < 11) return '早上好，看看今天的运行情况'
  if (hour < 14) return '中午好，服务状态一切就绪'
  if (hour < 18) return '下午好，后台运行稳定'
  if (hour < 23) return '晚上好，这是当前系统概览'
  return '夜深了，系统仍在运行'
})
const dateTimeLabel = computed(() => new Intl.DateTimeFormat('zh-CN', {
  month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(now.value))

const channelRows = computed(() => Object.entries(info.value.channelStats || {})
  .sort((a, b) => b[1] - a[1])
  .map(([name, count]) => ({ name, count, percent: indexedFiles.value ? (count / indexedFiles.value) * 100 : 0 })))

const statusRows = computed(() => {
  const values = info.value.typeStats || {}
  const blocked = Number(values.Block || 0)
  const normal = Object.entries(values).reduce((sum, [name, count]) => name === 'Block' ? sum : sum + Number(count), 0)
  return [
    { name: '正常文件', count: normal, color: 'bg-emerald-500' },
    { name: '已屏蔽', count: blocked, color: 'bg-red-500' },
  ]
})

const trendValues = computed(() => (info.value.uploadTrend?.total || []).map((value) => Number(value || 0)))
const trendLabels = computed(() => info.value.uploadTrend?.labels || [])
const trendPoints = computed(() => {
  const values = trendValues.value
  if (!values.length) return ''
  const max = Math.max(...values, 1)
  const step = values.length > 1 ? 100 / (values.length - 1) : 100
  return values.map((value, index) => `${index * step},${30 - (value / max) * 26}`).join(' ')
})
const trendTotal = computed(() => trendValues.value.reduce((sum, value) => sum + value, 0))
const trendSeries = computed(() => info.value.uploadTrend?.groupBy?.[trendGroupBy.value]?.series || [])

const quotaRows = computed(() => Object.entries(quota.value.quotaStats || {})
  .sort((a, b) => Number(b[1].usedMB || 0) - Number(a[1].usedMB || 0)))

const summaryCards = computed(() => [
  { label: '已索引文件', value: formatNumber(indexedFiles.value), hint: '索引中的全部文件', icon: Database },
  { label: '已用存储', value: formatSizeFromMb(Number(quota.value.totalSizeMB || 0)), hint: `${formatNumber(Number(quota.value.totalCount || 0))} 个容量记录`, icon: HardDrive },
  { label: '活跃渠道', value: formatNumber(channelCount.value), hint: '当前索引中的渠道类型', icon: Server },
  { label: '索引更新时间', value: formatRelativeTime(info.value.lastUpdated), hint: formatDateTime(info.value.lastUpdated), icon: Clock3 },
])

function getDateRange(days: number) {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - days + 1)
  const format = (date: Date) => date.toISOString().slice(0, 10)
  return { startDate: format(start), endDate: format(end) }
}

async function loadStatus(silent = false) {
  if (!silent) loading.value = true
  loadError.value = ''
  const { startDate, endDate } = getDateRange(7)
  const results = await Promise.allSettled([
    api.systemInfo({
      timezoneOffset: new Date().getTimezoneOffset(),
      trendMaxPoints: 90,
      trendSeriesLimit: 8,
      trendStartDate: startDate,
      trendEndDate: endDate,
    }),
    api.indexStorageStats(),
    api.quotaStats(),
  ])

  if (results[0].status === 'fulfilled') info.value = results[0].value as IndexInfo
  if (results[1].status === 'fulfilled') storage.value = results[1].value as IndexStorage
  if (results[2].status === 'fulfilled') quota.value = results[2].value as QuotaStats

  const rejected = results.find((result) => result.status === 'rejected')
  if (rejected?.status === 'rejected') {
    loadError.value = rejected.reason instanceof Error ? rejected.reason.message : '部分状态数据加载失败'
    toast.error(loadError.value)
  }
  loading.value = false
}

function updateProgress(input: unknown) {
  const payload = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const phase = String(payload.phase || '')
  const current = Number(payload.current || 0)
  const total = Number(payload.total || 0)
  let percentage = Number(payload.percentage || 0)
  if (!percentage) {
    if (phase === 'fetching') percentage = total ? Math.min(60, (current / total) * 60) : Math.min(50, Math.log10(current + 1) * 15)
    if (phase === 'sorting') percentage = 65
    if (phase === 'uploading') percentage = total ? 70 + (current / total) * 25 : 75
    if (phase === 'finalizing') percentage = 97
    if (phase === 'building') percentage = 80
    if (phase === 'downloading') percentage = 95
    if (phase === 'completed') percentage = 100
  }
  progress.value = { phase, current, total, percentage, message: String(payload.message || phaseLabel(phase)) }
}

function handleTaskError(error: TaskError) {
  processError.value = { message: error.message, suggestion: error.suggestion }
}

async function rebuildIndex() {
  if (processing.value || !window.confirm('重建索引会重新读取全部记录，确定继续吗？')) return
  startProcess('rebuild')
  const task = new IndexRebuilder({ onProgress: updateProgress, onError: handleTaskError })
  activeTask = task
  try {
    const result = await task.rebuild()
    toast.success(`索引重建完成，共 ${formatNumber(result.totalFiles)} 个文件`)
    await loadStatus(true)
  } catch (error) {
    if ((error as TaskError).code !== 'ABORTED') notifyTaskFailure(error, '索引重建失败')
  } finally {
    finishProcess()
  }
}

async function backupData() {
  if (processing.value) return
  startProcess('backup')
  const task = new BackupGenerator({ onProgress: updateProgress })
  activeTask = task
  try {
    const result = await task.generateBackup()
    toast.success(`备份已下载：${formatNumber(result.fileCount)} 个文件、${formatNumber(result.settingsCount)} 项设置`)
  } catch (error) {
    if ((error as TaskError).code !== 'ABORTED') notifyTaskFailure(error, '备份失败')
  } finally {
    finishProcess()
  }
}

function selectRestoreFile() {
  if (!processing.value) restoreInput.value?.click()
}

async function restoreData(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.json')) {
    toast.error('请选择 JSON 备份文件')
    return
  }
  if (!window.confirm('恢复会写入文件记录和系统设置，并在完成后重建索引。确定继续吗？')) return

  startProcess('restore')
  try {
    const data = JSON.parse(await file.text()) as unknown
    const task = new RestoreProcessor({ chunkSize: 100, onProgress: updateProgress, onError: handleTaskError })
    activeTask = task
    const result = await task.restore(data)
    toast.success(`恢复完成：${formatNumber(result.restoredFiles)} 个文件、${formatNumber(result.restoredSettings)} 项设置`)
  } catch (error) {
    if ((error as TaskError).code !== 'ABORTED') notifyTaskFailure(error, '恢复失败')
    finishProcess()
    return
  }
  finishProcess()
  await rebuildIndexAfterRestore()
}

async function rebuildIndexAfterRestore() {
  startProcess('rebuild')
  const task = new IndexRebuilder({ onProgress: updateProgress, onError: handleTaskError })
  activeTask = task
  try {
    await task.rebuild()
    toast.success('恢复后的索引已重建')
    await loadStatus(true)
  } catch (error) {
    if ((error as TaskError).code !== 'ABORTED') notifyTaskFailure(error, '索引重建失败')
  } finally {
    finishProcess()
  }
}

function startProcess(kind: 'rebuild' | 'backup' | 'restore') {
  processing.value = true
  processKind.value = kind
  processError.value = undefined
  progress.value = { phase: '', message: '正在准备…', current: 0, total: 0, percentage: 2 }
}

function finishProcess() {
  processing.value = false
  processKind.value = ''
  activeTask = undefined
}

function cancelProcess() {
  activeTask?.abort()
  toast.info('正在取消当前操作')
}

function notifyTaskFailure(error: unknown, fallback: string) {
  const typed = error as TaskError
  const message = typed?.message || fallback
  processError.value = { message, suggestion: typed?.suggestion }
  toast.error(message)
}

function phaseLabel(phase: string) {
  return ({
    fetching: '正在读取数据', sorting: '正在整理索引', uploading: '正在写入索引', finalizing: '正在完成',
    building: '正在生成备份', downloading: '正在下载', restoring_files: '正在恢复文件',
    restoring_settings: '正在恢复设置', retrying: '请求失败，正在重试', completed: '操作完成',
  } as Record<string, string>)[phase] || '正在处理'
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value || 0)
}

function formatSize(value: number) {
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1 }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`
}

function formatSizeFromMb(value: number) {
  return formatSize(value * 1024 * 1024)
}

function formatDateTime(value?: number | string) {
  if (!value) return '暂无记录'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '暂无记录'
  return date.toLocaleString('zh-CN', { hour12: false })
}

function formatRelativeTime(value?: number | string) {
  if (!value) return '尚未建立'
  const diff = Date.now() - new Date(value).getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${Math.floor(diff / 86_400_000)} 天前`
}

function fileName(file?: FileRecord) {
  return file?.metadata?.FileName || file?.id || '暂无文件'
}

function fileUrl(file?: FileRecord) {
  return file?.id ? `/file/${file.id}?from=admin` : '#'
}

function shortTrendLabel(index: number) {
  const label = trendLabels.value[index] || ''
  const matches = label.match(/\d{4}-\d{2}-\d{2}/g)
  if (!matches?.length) return label
  const first = matches[0]
  return first ? first.slice(5).replace('-', '/') : label
}

onMounted(() => {
  void loadStatus()
  clockTimer = window.setInterval(() => { now.value = new Date() }, 1000)
})

onBeforeUnmount(() => {
  if (clockTimer) window.clearInterval(clockTimer)
  activeTask?.abort()
})
</script>

<template>
  <AdminShell title="系统状态" description="索引、存储与维护任务的实时概览">
    <template #header-actions>
      <Button variant="outline" size="sm" :disabled="loading" @click="loadStatus()">
        <RefreshCw :class="loading && 'animate-spin'" />
        <span class="hidden sm:inline">刷新</span>
      </Button>
    </template>

    <section class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <Badge :variant="isHealthy ? 'success' : 'destructive'">
            <CheckCircle2 v-if="isHealthy" class="mr-1 size-3" />
            <ShieldAlert v-else class="mr-1 size-3" />
            {{ isHealthy ? '系统运行正常' : '部分数据不可用' }}
          </Badge>
          <span class="text-xs text-muted-foreground">{{ dateTimeLabel }}</span>
        </div>
        <PageHeading eyebrow="Overview" :title="greeting" description="这里集中展示 Cloudflare ImgBed 的索引、上传趋势、渠道容量与维护任务。" />
      </div>
      <Badge variant="outline" class="w-fit rounded-md px-2.5 py-1 font-mono">v{{ packageInfo.version }}</Badge>
    </section>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Skeleton v-for="index in 4" :key="index" class="h-32 rounded-xl" />
    </div>
    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card v-for="card in summaryCards" :key="card.label" class="p-5 shadow-none">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm text-muted-foreground">{{ card.label }}</p>
            <p class="mt-2 text-2xl font-semibold tracking-tight">{{ card.value }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ card.hint }}</p>
          </div>
          <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"><component :is="card.icon" class="size-4" /></span>
        </div>
      </Card>
    </div>

    <div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
      <Card class="overflow-hidden shadow-none">
        <div class="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div class="flex items-center gap-2 font-semibold"><Activity class="size-4 text-primary" />上传趋势</div>
            <p class="mt-1 text-xs text-muted-foreground">所选时间段共 {{ formatNumber(trendTotal) }} 次上传</p>
          </div>
          <div class="flex gap-2">
            <Select v-model="trendGroupBy">
              <SelectTrigger class="h-9 w-32 text-xs" aria-label="趋势分组"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="channel">按渠道类型</SelectItem>
                <SelectItem value="channelName">按渠道名称</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div class="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_190px]">
          <div class="min-w-0">
            <div v-if="trendPoints" class="relative h-64 rounded-lg border bg-muted/20 p-4">
              <div class="absolute inset-x-4 top-1/4 border-t border-dashed" />
              <div class="absolute inset-x-4 top-1/2 border-t border-dashed" />
              <div class="absolute inset-x-4 top-3/4 border-t border-dashed" />
              <svg class="relative h-[calc(100%-28px)] w-full overflow-visible" viewBox="0 0 100 32" preserveAspectRatio="none" role="img" aria-label="上传趋势折线图">
                <polyline :points="trendPoints" fill="none" stroke="currentColor" stroke-width="1.4" vector-effect="non-scaling-stroke" class="text-primary" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <div class="mt-2 flex justify-between text-[10px] text-muted-foreground">
                <span>{{ shortTrendLabel(0) }}</span>
                <span>{{ shortTrendLabel(Math.floor((trendLabels.length - 1) / 2)) }}</span>
                <span>{{ shortTrendLabel(trendLabels.length - 1) }}</span>
              </div>
            </div>
            <div v-else class="grid h-64 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">所选时间段暂无上传数据</div>
          </div>
          <div>
            <p class="mb-3 text-xs font-medium text-muted-foreground">主要来源</p>
            <div class="space-y-3">
              <div v-for="series in trendSeries.slice(0, 6)" :key="series.name" class="flex items-center justify-between gap-3 text-sm">
                <span class="min-w-0 truncate">{{ series.isOther ? '其他渠道' : series.name }}</span>
                <span class="font-mono text-xs text-muted-foreground">{{ formatNumber((series.data || []).reduce((sum, value) => sum + Number(value), 0)) }}</span>
              </div>
              <p v-if="!trendSeries.length" class="text-xs text-muted-foreground">暂无渠道明细</p>
            </div>
          </div>
        </div>
      </Card>

      <Card class="shadow-none">
        <div class="border-b p-5">
          <div class="flex items-center gap-2 font-semibold"><Boxes class="size-4 text-primary" />渠道分布</div>
          <p class="mt-1 text-xs text-muted-foreground">索引文件按存储类型统计</p>
        </div>
        <div class="space-y-4 p-5">
          <div v-for="row in channelRows.slice(0, 7)" :key="row.name">
            <div class="mb-1.5 flex items-center justify-between text-xs"><span class="font-medium">{{ row.name }}</span><span class="text-muted-foreground">{{ formatNumber(row.count) }} · {{ row.percent.toFixed(0) }}%</span></div>
            <Progress :model-value="row.percent" />
          </div>
          <p v-if="!channelRows.length" class="py-10 text-center text-sm text-muted-foreground">暂无渠道数据</p>
        </div>
      </Card>
    </div>

    <div class="mt-6 grid gap-6 xl:grid-cols-3">
      <Card class="shadow-none">
        <div class="border-b p-5">
          <div class="flex items-center gap-2 font-semibold"><ShieldAlert class="size-4 text-primary" />文件状态</div>
          <p class="mt-1 text-xs text-muted-foreground">正常与屏蔽记录分布</p>
        </div>
        <div class="space-y-5 p-5">
          <div v-for="row in statusRows" :key="row.name">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm"><span class="size-2 rounded-full" :class="row.color" />{{ row.name }}</div>
              <span class="font-mono text-sm">{{ formatNumber(row.count) }}</span>
            </div>
            <Progress class="mt-2" :model-value="indexedFiles ? (row.count / indexedFiles) * 100 : 0" />
          </div>
        </div>
      </Card>

      <Card class="shadow-none">
        <div class="border-b p-5">
          <div class="flex items-center gap-2 font-semibold"><HardDrive class="size-4 text-primary" />渠道容量</div>
          <p class="mt-1 text-xs text-muted-foreground">容量元数据中的实际占用</p>
        </div>
        <div class="divide-y px-5">
          <div v-for="[name, stats] in quotaRows.slice(0, 6)" :key="name" class="flex items-center justify-between gap-4 py-3">
            <div class="min-w-0"><p class="truncate text-sm font-medium">{{ name }}</p><p class="text-xs text-muted-foreground">{{ formatNumber(Number(stats.fileCount || 0)) }} 个文件</p></div>
            <span class="shrink-0 font-mono text-xs">{{ formatSizeFromMb(Number(stats.usedMB || 0)) }}</span>
          </div>
          <p v-if="!quotaRows.length" class="py-10 text-center text-sm text-muted-foreground">暂无容量统计</p>
        </div>
      </Card>

      <Card class="shadow-none">
        <div class="border-b p-5">
          <div class="flex items-center gap-2 font-semibold"><Archive class="size-4 text-primary" />索引存储</div>
          <p class="mt-1 text-xs text-muted-foreground">分块完整性与索引体积</p>
        </div>
        <div class="grid grid-cols-2 gap-px bg-border">
          <div class="bg-card p-4"><p class="text-xs text-muted-foreground">索引模式</p><p class="mt-1 text-sm font-medium">{{ storage.isChunked ? '分块索引' : '未检测到' }}</p></div>
          <div class="bg-card p-4"><p class="text-xs text-muted-foreground">完整分块</p><p class="mt-1 text-sm font-medium">{{ storage.existingChunks || 0 }} / {{ storage.totalChunks || 0 }}</p></div>
          <div class="bg-card p-4"><p class="text-xs text-muted-foreground">索引体积</p><p class="mt-1 text-sm font-medium">{{ formatSize(Number(storage.totalSize || 0)) }}</p></div>
          <div class="bg-card p-4"><p class="text-xs text-muted-foreground">一致性</p><Badge class="mt-1" :variant="storage.totalChunks === storage.existingChunks ? 'success' : 'destructive'">{{ storage.totalChunks === storage.existingChunks ? '完整' : '需检查' }}</Badge></div>
        </div>
      </Card>
    </div>

    <div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <Card class="shadow-none">
        <div class="border-b p-5">
          <div class="flex items-center gap-2 font-semibold"><RotateCcw class="size-4 text-primary" />系统维护</div>
          <p class="mt-1 text-xs text-muted-foreground">这些操作会读取或写入后端数据，请勿重复触发。</p>
        </div>
        <div class="p-5">
          <div v-if="processing" class="rounded-lg border bg-muted/20 p-4">
            <div class="flex items-center justify-between gap-3"><div class="flex items-center gap-2 text-sm font-medium"><LoaderCircle class="size-4 animate-spin text-primary" />{{ progress.message }}</div><span class="font-mono text-xs">{{ Math.round(progress.percentage) }}%</span></div>
            <Progress class="mt-3" :model-value="progress.percentage" />
            <div class="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{{ progress.total ? `${formatNumber(progress.current)} / ${formatNumber(progress.total)}` : phaseLabel(progress.phase) }}</span><Button variant="ghost" size="sm" @click="cancelProcess"><X />取消</Button></div>
          </div>
          <div v-else-if="processError" class="rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm">
            <p class="font-medium text-destructive">{{ processError.message }}</p><p v-if="processError.suggestion" class="mt-1 text-xs text-muted-foreground">{{ processError.suggestion }}</p>
          </div>
          <div v-else class="grid gap-3 sm:grid-cols-3">
            <button type="button" class="focus-ring rounded-lg border p-4 text-left transition hover:bg-muted/50" @click="rebuildIndex"><RefreshCw class="size-5 text-primary" /><p class="mt-3 text-sm font-medium">重建索引</p><p class="mt-1 text-xs leading-5 text-muted-foreground">重新扫描记录并生成分块索引。</p></button>
            <button type="button" class="focus-ring rounded-lg border p-4 text-left transition hover:bg-muted/50" @click="backupData"><ArrowDownToLine class="size-5 text-primary" /><p class="mt-3 text-sm font-medium">备份数据</p><p class="mt-1 text-xs leading-5 text-muted-foreground">下载文件记录和系统设置 JSON。</p></button>
            <button type="button" class="focus-ring rounded-lg border p-4 text-left transition hover:bg-muted/50" @click="selectRestoreFile"><ArrowUpFromLine class="size-5 text-primary" /><p class="mt-3 text-sm font-medium">恢复备份</p><p class="mt-1 text-xs leading-5 text-muted-foreground">分批恢复 JSON 并重建索引。</p></button>
            <input ref="restoreInput" type="file" accept=".json,application/json" class="hidden" @change="restoreData" />
          </div>
        </div>
      </Card>

      <Card class="shadow-none">
        <div class="border-b p-5">
          <div class="flex items-center gap-2 font-semibold"><FileClock class="size-4 text-primary" />文件时间线</div>
          <p class="mt-1 text-xs text-muted-foreground">索引中最早与最新的文件</p>
        </div>
        <div class="p-5">
          <a :href="fileUrl(info.newestFile)" target="_blank" class="focus-ring block rounded-lg border p-4 transition hover:bg-muted/50">
            <div class="flex items-center gap-2 text-xs text-muted-foreground"><ArrowUpFromLine class="size-3.5" />最新上传</div>
            <p class="mt-2 truncate text-sm font-medium">{{ fileName(info.newestFile) }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ formatDateTime(info.newestFile?.metadata?.TimeStamp) }}</p>
          </a>
          <div class="my-3 flex items-center gap-3"><Separator /><span class="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">至</span><Separator /></div>
          <a :href="fileUrl(info.oldestFile)" target="_blank" class="focus-ring block rounded-lg border p-4 transition hover:bg-muted/50">
            <div class="flex items-center gap-2 text-xs text-muted-foreground"><ArrowDownToLine class="size-3.5" />最早上传</div>
            <p class="mt-2 truncate text-sm font-medium">{{ fileName(info.oldestFile) }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ formatDateTime(info.oldestFile?.metadata?.TimeStamp) }}</p>
          </a>
        </div>
      </Card>
    </div>
  </AdminShell>
</template>
