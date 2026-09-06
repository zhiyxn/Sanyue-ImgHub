<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
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

const { t, locale } = useI18n()
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
  if (hour < 5) return t('modern.status.greetingLate')
  if (hour < 11) return t('modern.status.greetingMorning')
  if (hour < 14) return t('modern.status.greetingNoon')
  if (hour < 18) return t('modern.status.greetingAfternoon')
  if (hour < 23) return t('modern.status.greetingEvening')
  return t('modern.status.greetingLate')
})
const dateTimeLabel = computed(() => new Intl.DateTimeFormat(locale.value, {
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
    { name: t('modern.status.normalFiles'), count: normal, color: 'bg-emerald-500' },
    { name: t('sysStatus.blocked'), count: blocked, color: 'bg-red-500' },
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
  { label: t('modern.status.indexedFiles'), value: formatNumber(indexedFiles.value), hint: t('modern.status.allIndexedFiles'), icon: Database },
  { label: t('modern.status.usedStorage'), value: formatSizeFromMb(Number(quota.value.totalSizeMB || 0)), hint: t('modern.status.capacityRecords', { count: formatNumber(Number(quota.value.totalCount || 0)) }), icon: HardDrive },
  { label: t('modern.status.activeChannels'), value: formatNumber(channelCount.value), hint: t('modern.status.indexedChannelTypes'), icon: Server },
  { label: t('sysStatus.indexUpdateTime'), value: formatRelativeTime(info.value.lastUpdated), hint: formatDateTime(info.value.lastUpdated), icon: Clock3 },
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
    loadError.value = rejected.reason instanceof Error ? rejected.reason.message : t('modern.status.partialLoadFailed')
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
  if (processing.value || !window.confirm(t('modern.status.rebuildConfirm'))) return
  startProcess('rebuild')
  const task = new IndexRebuilder({ onProgress: updateProgress, onError: handleTaskError })
  activeTask = task
  try {
    const result = await task.rebuild()
    toast.success(t('modern.status.rebuildDone', { count: formatNumber(result.totalFiles) }))
    await loadStatus(true)
  } catch (error) {
    if ((error as TaskError).code !== 'ABORTED') notifyTaskFailure(error, t('modern.status.rebuildFailed'))
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
    toast.success(t('modern.status.backupDone', { files: formatNumber(result.fileCount), settings: formatNumber(result.settingsCount) }))
  } catch (error) {
    if ((error as TaskError).code !== 'ABORTED') notifyTaskFailure(error, t('modern.status.backupFailed'))
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
    toast.error(t('sysStatus.selectJsonFile'))
    return
  }
  if (!window.confirm(t('modern.status.restoreConfirm'))) return

  startProcess('restore')
  try {
    const data = JSON.parse(await file.text()) as unknown
    const task = new RestoreProcessor({ chunkSize: 100, onProgress: updateProgress, onError: handleTaskError })
    activeTask = task
    const result = await task.restore(data)
    toast.success(t('modern.status.restoreDone', { files: formatNumber(result.restoredFiles), settings: formatNumber(result.restoredSettings) }))
  } catch (error) {
    if ((error as TaskError).code !== 'ABORTED') notifyTaskFailure(error, t('sysStatus.restoreFailed'))
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
    toast.success(t('modern.status.restoredIndexRebuilt'))
    await loadStatus(true)
  } catch (error) {
    if ((error as TaskError).code !== 'ABORTED') notifyTaskFailure(error, t('modern.status.rebuildFailed'))
  } finally {
    finishProcess()
  }
}

function startProcess(kind: 'rebuild' | 'backup' | 'restore') {
  processing.value = true
  processKind.value = kind
  processError.value = undefined
  progress.value = { phase: '', message: t('modern.status.preparing'), current: 0, total: 0, percentage: 2 }
}

function finishProcess() {
  processing.value = false
  processKind.value = ''
  activeTask = undefined
}

function cancelProcess() {
  activeTask?.abort()
  toast.info(t('modern.status.cancelling'))
}

function notifyTaskFailure(error: unknown, fallback: string) {
  const typed = error as TaskError
  const message = typed?.message || fallback
  processError.value = { message, suggestion: typed?.suggestion }
  toast.error(message)
}

function phaseLabel(phase: string) {
  return ({
    fetching: t('sysStatus.phaseFetching'), sorting: t('sysStatus.phaseSorting'), uploading: t('sysStatus.phaseUploading'), finalizing: t('sysStatus.phaseFinalizing'),
    building: t('sysStatus.phaseBuilding'), downloading: t('sysStatus.phaseDownloading'), restoring_files: t('sysStatus.phaseRestoringFiles'),
    restoring_settings: t('sysStatus.phaseRestoringSettings'), retrying: t('sysStatus.phaseRetrying'), completed: t('sysStatus.phaseCompleted'),
  } as Record<string, string>)[phase] || t('modern.status.processing')
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(locale.value).format(value || 0)
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
  if (!value) return t('modern.status.noRecord')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return t('modern.status.noRecord')
  return date.toLocaleString(locale.value, { hour12: false })
}

function formatRelativeTime(value?: number | string) {
  if (!value) return t('modern.status.notBuilt')
  const diff = Date.now() - new Date(value).getTime()
  if (diff < 60_000) return t('sysStatus.justNow')
  if (diff < 3_600_000) return t('sysStatus.minutesAgo', { count: Math.floor(diff / 60_000) })
  if (diff < 86_400_000) return t('sysStatus.hoursAgo', { count: Math.floor(diff / 3_600_000) })
  return t('sysStatus.daysAgo', { count: Math.floor(diff / 86_400_000) })
}

function fileName(file?: FileRecord) {
  return file?.metadata?.FileName || file?.id || t('modern.status.noFile')
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
  <AdminShell :title="t('sysStatus.systemOverview')" :description="t('modern.status.shellDescription')">
    <template #header-actions>
      <Button variant="outline" size="sm" :disabled="loading" @click="loadStatus()">
        <RefreshCw :class="loading && 'animate-spin'" />
        <span class="hidden sm:inline">{{ t('modern.status.refresh') }}</span>
      </Button>
    </template>

    <section class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <Badge :variant="isHealthy ? 'success' : 'destructive'">
            <CheckCircle2 v-if="isHealthy" class="mr-1 size-3" />
            <ShieldAlert v-else class="mr-1 size-3" />
            {{ t(isHealthy ? 'modern.status.healthy' : 'modern.status.degraded') }}
          </Badge>
          <span class="text-xs text-muted-foreground">{{ dateTimeLabel }}</span>
        </div>
        <PageHeading :eyebrow="t('modern.status.overview')" :title="greeting" :description="t('modern.status.description')" />
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
            <div class="flex items-center gap-2 font-semibold"><Activity class="size-4 text-primary" />{{ t('sysStatus.uploadTrend') }}</div>
            <p class="mt-1 text-xs text-muted-foreground">{{ t('modern.status.lastSevenUploads', { count: formatNumber(trendTotal) }) }}</p>
          </div>
          <div class="flex gap-2">
            <Select v-model="trendGroupBy">
              <SelectTrigger class="h-9 w-32 text-xs" :aria-label="t('sysStatus.uploadTrendGroupBy')"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="channel">{{ t('sysStatus.byChannelType') }}</SelectItem>
                <SelectItem value="channelName">{{ t('sysStatus.byChannelName') }}</SelectItem>
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
              <svg class="relative h-[calc(100%-28px)] w-full overflow-visible" viewBox="0 0 100 32" preserveAspectRatio="none" role="img" :aria-label="t('modern.status.trendChart')">
                <polyline :points="trendPoints" fill="none" stroke="currentColor" stroke-width="1.4" vector-effect="non-scaling-stroke" class="text-primary" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <div class="mt-2 flex justify-between text-[10px] text-muted-foreground">
                <span>{{ shortTrendLabel(0) }}</span>
                <span>{{ shortTrendLabel(Math.floor((trendLabels.length - 1) / 2)) }}</span>
                <span>{{ shortTrendLabel(trendLabels.length - 1) }}</span>
              </div>
            </div>
            <div v-else class="grid h-64 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">{{ t('modern.status.noSevenDayData') }}</div>
          </div>
          <div>
            <p class="mb-3 text-xs font-medium text-muted-foreground">{{ t('modern.status.topSources') }}</p>
            <div class="space-y-3">
              <div v-for="series in trendSeries.slice(0, 6)" :key="series.name" class="flex items-center justify-between gap-3 text-sm">
                <span class="min-w-0 truncate">{{ series.isOther ? t('sysStatus.otherChannels') : series.name }}</span>
                <span class="font-mono text-xs text-muted-foreground">{{ formatNumber((series.data || []).reduce((sum, value) => sum + Number(value), 0)) }}</span>
              </div>
              <p v-if="!trendSeries.length" class="text-xs text-muted-foreground">{{ t('modern.status.noChannelDetails') }}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card class="shadow-none">
        <div class="border-b p-5">
          <div class="flex items-center gap-2 font-semibold"><Boxes class="size-4 text-primary" />{{ t('sysStatus.channelDistribution') }}</div>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('modern.status.channelDistributionHint') }}</p>
        </div>
        <div class="space-y-4 p-5">
          <div v-for="row in channelRows.slice(0, 7)" :key="row.name">
            <div class="mb-1.5 flex items-center justify-between text-xs"><span class="font-medium">{{ row.name }}</span><span class="text-muted-foreground">{{ formatNumber(row.count) }} · {{ row.percent.toFixed(0) }}%</span></div>
            <Progress :model-value="row.percent" />
          </div>
          <p v-if="!channelRows.length" class="py-10 text-center text-sm text-muted-foreground">{{ t('modern.status.noChannelData') }}</p>
        </div>
      </Card>
    </div>

    <div class="mt-6 grid gap-6 xl:grid-cols-3">
      <Card class="shadow-none">
        <div class="border-b p-5">
          <div class="flex items-center gap-2 font-semibold"><ShieldAlert class="size-4 text-primary" />{{ t('modern.status.fileStatus') }}</div>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('modern.status.fileStatusHint') }}</p>
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
          <div class="flex items-center gap-2 font-semibold"><HardDrive class="size-4 text-primary" />{{ t('modern.status.channelCapacity') }}</div>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('modern.status.channelCapacityHint') }}</p>
        </div>
        <div class="divide-y px-5">
          <div v-for="[name, stats] in quotaRows.slice(0, 6)" :key="name" class="flex items-center justify-between gap-4 py-3">
            <div class="min-w-0"><p class="truncate text-sm font-medium">{{ name }}</p><p class="text-xs text-muted-foreground">{{ t('modern.status.fileCount', { count: formatNumber(Number(stats.fileCount || 0)) }) }}</p></div>
            <span class="shrink-0 font-mono text-xs">{{ formatSizeFromMb(Number(stats.usedMB || 0)) }}</span>
          </div>
          <p v-if="!quotaRows.length" class="py-10 text-center text-sm text-muted-foreground">{{ t('modern.status.noCapacityData') }}</p>
        </div>
      </Card>

      <Card class="shadow-none">
        <div class="border-b p-5">
          <div class="flex items-center gap-2 font-semibold"><Archive class="size-4 text-primary" />{{ t('modern.status.indexStorage') }}</div>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('modern.status.indexStorageHint') }}</p>
        </div>
        <div class="grid grid-cols-2 gap-px bg-border">
          <div class="bg-card p-4"><p class="text-xs text-muted-foreground">{{ t('modern.status.indexMode') }}</p><p class="mt-1 text-sm font-medium">{{ t(storage.isChunked ? 'modern.status.chunkedIndex' : 'modern.status.notDetected') }}</p></div>
          <div class="bg-card p-4"><p class="text-xs text-muted-foreground">{{ t('modern.status.completeChunks') }}</p><p class="mt-1 text-sm font-medium">{{ storage.existingChunks || 0 }} / {{ storage.totalChunks || 0 }}</p></div>
          <div class="bg-card p-4"><p class="text-xs text-muted-foreground">{{ t('modern.status.indexSize') }}</p><p class="mt-1 text-sm font-medium">{{ formatSize(Number(storage.totalSize || 0)) }}</p></div>
          <div class="bg-card p-4"><p class="text-xs text-muted-foreground">{{ t('modern.status.consistency') }}</p><Badge class="mt-1" :variant="storage.totalChunks === storage.existingChunks ? 'success' : 'destructive'">{{ t(storage.totalChunks === storage.existingChunks ? 'modern.status.complete' : 'modern.status.checkRequired') }}</Badge></div>
        </div>
      </Card>
    </div>

    <div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <Card class="shadow-none">
        <div class="border-b p-5">
          <div class="flex items-center gap-2 font-semibold"><RotateCcw class="size-4 text-primary" />{{ t('sysStatus.systemMaintenance') }}</div>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('modern.status.maintenanceHint') }}</p>
        </div>
        <div class="p-5">
          <div v-if="processing" class="rounded-lg border bg-muted/20 p-4">
            <div class="flex items-center justify-between gap-3"><div class="flex items-center gap-2 text-sm font-medium"><LoaderCircle class="size-4 animate-spin text-primary" />{{ progress.message }}</div><span class="font-mono text-xs">{{ Math.round(progress.percentage) }}%</span></div>
            <Progress class="mt-3" :model-value="progress.percentage" />
            <div class="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{{ progress.total ? `${formatNumber(progress.current)} / ${formatNumber(progress.total)}` : phaseLabel(progress.phase) }}</span><Button variant="ghost" size="sm" @click="cancelProcess"><X />{{ t('sysStatus.cancelOperation') }}</Button></div>
          </div>
          <div v-else-if="processError" class="rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm">
            <p class="font-medium text-destructive">{{ processError.message }}</p><p v-if="processError.suggestion" class="mt-1 text-xs text-muted-foreground">{{ processError.suggestion }}</p>
          </div>
          <div v-else class="grid gap-3 sm:grid-cols-3">
            <button type="button" class="focus-ring rounded-lg border p-4 text-left transition hover:bg-muted/50" @click="rebuildIndex"><RefreshCw class="size-5 text-primary" /><p class="mt-3 text-sm font-medium">{{ t('sysStatus.rebuildIndex') }}</p><p class="mt-1 text-xs leading-5 text-muted-foreground">{{ t('modern.status.rebuildHint') }}</p></button>
            <button type="button" class="focus-ring rounded-lg border p-4 text-left transition hover:bg-muted/50" @click="backupData"><ArrowDownToLine class="size-5 text-primary" /><p class="mt-3 text-sm font-medium">{{ t('sysStatus.backupData') }}</p><p class="mt-1 text-xs leading-5 text-muted-foreground">{{ t('modern.status.backupHint') }}</p></button>
            <button type="button" class="focus-ring rounded-lg border p-4 text-left transition hover:bg-muted/50" @click="selectRestoreFile"><ArrowUpFromLine class="size-5 text-primary" /><p class="mt-3 text-sm font-medium">{{ t('sysStatus.restoreData') }}</p><p class="mt-1 text-xs leading-5 text-muted-foreground">{{ t('modern.status.restoreHint') }}</p></button>
            <input ref="restoreInput" type="file" accept=".json,application/json" class="hidden" @change="restoreData" />
          </div>
        </div>
      </Card>

      <Card class="shadow-none">
        <div class="border-b p-5">
          <div class="flex items-center gap-2 font-semibold"><FileClock class="size-4 text-primary" />{{ t('modern.status.fileTimeline') }}</div>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('modern.status.fileTimelineHint') }}</p>
        </div>
        <div class="p-5">
          <a :href="fileUrl(info.newestFile)" target="_blank" class="focus-ring block rounded-lg border p-4 transition hover:bg-muted/50">
            <div class="flex items-center gap-2 text-xs text-muted-foreground"><ArrowUpFromLine class="size-3.5" />{{ t('sysStatus.latestUpload') }}</div>
            <p class="mt-2 truncate text-sm font-medium">{{ fileName(info.newestFile) }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ formatDateTime(info.newestFile?.metadata?.TimeStamp) }}</p>
          </a>
          <div class="my-3 flex items-center gap-3"><Separator /><span class="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">{{ t('modern.status.to') }}</span><Separator /></div>
          <a :href="fileUrl(info.oldestFile)" target="_blank" class="focus-ring block rounded-lg border p-4 transition hover:bg-muted/50">
            <div class="flex items-center gap-2 text-xs text-muted-foreground"><ArrowDownToLine class="size-3.5" />{{ t('sysStatus.earliestUpload') }}</div>
            <p class="mt-2 truncate text-sm font-medium">{{ fileName(info.oldestFile) }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ formatDateTime(info.oldestFile?.metadata?.TimeStamp) }}</p>
          </a>
        </div>
      </Card>
    </div>
  </AdminShell>
</template>
