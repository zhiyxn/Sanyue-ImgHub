<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Ban,
  ChevronDown,
  File,
  FileVideo,
  Image as ImageIcon,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  UploadCloud,
  Users,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import AdminShell from '@/components/modern/AdminShell.vue'
import EmptyState from '@/components/modern/EmptyState.vue'
import PageHeading from '@/components/modern/PageHeading.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { api } from '@/services/api'
import { formatDate } from '@/lib/utils'
import type { CustomerSummary, FileRecord } from '@/types/api'

interface CustomerRow extends CustomerSummary {
  allowed: boolean
  expanded: boolean
  files: FileRecord[]
  fileTotal: number
  filesLoading: boolean
}

const customerBatchSize = 20
const fileBatchSize = 12
const pageSize = 10

const rows = ref<CustomerRow[]>([])
const blockedIps = ref(new Set<string>())
const busyIps = ref(new Set<string>())
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')
const hasMore = ref(true)
const search = ref('')
const currentPage = ref(1)

const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return rows.value
  return rows.value.filter((row) => `${row.ip} ${row.address}`.toLowerCase().includes(keyword))
})
const pageCount = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize)))
const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredRows.value.slice(start, start + pageSize)
})
const knownUploads = computed(() => rows.value.reduce((total, row) => total + row.count, 0))

watch(search, () => {
  currentPage.value = 1
})
watch(pageCount, (count) => {
  if (currentPage.value > count) currentPage.value = count
})

function makeRow(item: CustomerSummary): CustomerRow {
  return {
    ...item,
    allowed: !blockedIps.value.has(item.ip),
    expanded: false,
    files: [],
    fileTotal: item.count,
    filesLoading: false,
  }
}

async function loadInitial() {
  loading.value = true
  error.value = ''
  try {
    const [customers, blocked] = await Promise.all([
      api.customers(0, customerBatchSize),
      api.blockedCustomerIps(),
    ])
    blockedIps.value = new Set(blocked)
    rows.value = customers.map(makeRow)
    hasMore.value = customers.length === customerBatchSize
    currentPage.value = 1
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '无法同步用户列表'
  } finally {
    loading.value = false
  }
}

async function loadMoreCustomers() {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  try {
    const customers = await api.customers(rows.value.length, customerBatchSize)
    const existing = new Set(rows.value.map((row) => row.ip))
    rows.value.push(...customers.filter((item) => !existing.has(item.ip)).map(makeRow))
    hasMore.value = customers.length === customerBatchSize
  } catch (reason) {
    toast.error(reason instanceof Error ? reason.message : '加载更多用户失败')
  } finally {
    loadingMore.value = false
  }
}

async function nextPage() {
  if (!search.value && currentPage.value >= pageCount.value && hasMore.value) {
    await loadMoreCustomers()
  }
  if (currentPage.value < pageCount.value) currentPage.value += 1
}

async function toggleExpanded(row: CustomerRow) {
  row.expanded = !row.expanded
  if (row.expanded && !row.files.length) await loadFiles(row)
}

async function loadFiles(row: CustomerRow) {
  if (row.filesLoading || row.files.length >= row.fileTotal) return
  row.filesLoading = true
  try {
    const result = await api.customerFiles(row.ip, row.files.length, fileBatchSize)
    const existing = new Set(row.files.map((file) => file.id || file.name))
    row.files.push(...result.data.filter((file) => !existing.has(file.id || file.name)))
    row.fileTotal = result.total
  } catch (reason) {
    toast.error(reason instanceof Error ? reason.message : '无法读取该用户的文件')
  } finally {
    row.filesLoading = false
  }
}

async function setAllowed(row: CustomerRow, allowed: boolean) {
  if (busyIps.value.has(row.ip)) return
  const previous = row.allowed
  row.allowed = allowed
  busyIps.value = new Set(busyIps.value).add(row.ip)
  try {
    await api.setCustomerAllowed(row.ip, allowed)
    const nextBlocked = new Set(blockedIps.value)
    allowed ? nextBlocked.delete(row.ip) : nextBlocked.add(row.ip)
    blockedIps.value = nextBlocked
    toast.success(allowed ? `已允许 ${row.ip} 上传` : `已禁止 ${row.ip} 上传`)
  } catch (reason) {
    row.allowed = previous
    toast.error(reason instanceof Error ? reason.message : '更新上传权限失败')
  } finally {
    const nextBusy = new Set(busyIps.value)
    nextBusy.delete(row.ip)
    busyIps.value = nextBusy
  }
}

function encodePath(value: string) {
  return value.split('/').map(encodeURIComponent).join('/')
}

function fileUrl(file: FileRecord) {
  return `/file/${encodePath(file.id || file.name)}?from=admin`
}

function displayName(file: FileRecord) {
  return file.metadata?.FileName || file.name.split('/').pop() || file.name
}

function isImage(file: FileRecord) {
  return file.metadata?.FileType?.startsWith('image/') || /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(file.name)
}

function isVideo(file: FileRecord) {
  return file.metadata?.FileType?.startsWith('video/')
}

onMounted(loadInitial)
</script>

<template>
  <AdminShell title="用户管理" description="按上传来源查看文件并控制访问权限">
    <div class="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <PageHeading eyebrow="Customers" title="用户管理" description="查看上传来源、归属地和文件记录，并按 IP 允许或禁止上传。" />
      <Button variant="outline" :disabled="loading" @click="loadInitial"><RefreshCw :class="loading && 'animate-spin'" />刷新数据</Button>
    </div>

    <div class="mb-5 grid gap-3 sm:grid-cols-3">
      <Card class="flex items-center gap-4 p-4 shadow-none">
        <span class="grid size-10 place-items-center rounded-xl bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900"><Users class="size-5" /></span>
        <div><p class="text-2xl font-semibold tracking-tight">{{ rows.length }}</p><p class="text-xs text-muted-foreground">已加载上传来源</p></div>
      </Card>
      <Card class="flex items-center gap-4 p-4 shadow-none">
        <span class="grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400"><UploadCloud class="size-5" /></span>
        <div><p class="text-2xl font-semibold tracking-tight">{{ knownUploads }}</p><p class="text-xs text-muted-foreground">已统计上传文件</p></div>
      </Card>
      <Card class="flex items-center gap-4 p-4 shadow-none">
        <span class="grid size-10 place-items-center rounded-xl bg-destructive/10 text-destructive"><Ban class="size-5" /></span>
        <div><p class="text-2xl font-semibold tracking-tight">{{ blockedIps.size }}</p><p class="text-xs text-muted-foreground">禁止上传的 IP</p></div>
      </Card>
    </div>

    <Card class="overflow-hidden shadow-none">
      <div class="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 class="font-semibold">上传来源</h2><p class="mt-1 text-xs text-muted-foreground">默认按上传数量从高到低排列，展开后按时间查看文件。</p></div>
        <div class="relative w-full sm:w-72">
          <Search class="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input v-model="search" class="pl-9" placeholder="搜索 IP 或归属地…" />
        </div>
      </div>

      <div v-if="loading" class="space-y-2 p-4">
        <Skeleton v-for="index in 6" :key="index" class="h-16 rounded-lg" />
      </div>
      <EmptyState v-else-if="error" class="m-5" title="无法读取用户列表" :description="error"><Button variant="outline" @click="loadInitial">重新加载</Button></EmptyState>
      <EmptyState v-else-if="!filteredRows.length" class="m-5" title="没有匹配的上传来源" description="更换关键词，或等待新的文件上传记录。" />

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="border-b bg-muted/45 text-xs text-muted-foreground">
            <tr><th class="w-12 px-4 py-3"></th><th class="px-4 py-3 font-medium">IP 地址</th><th class="px-4 py-3 font-medium">归属地</th><th class="px-4 py-3 text-right font-medium">上传数量</th><th class="px-4 py-3 text-right font-medium">上传权限</th></tr>
          </thead>
          <tbody>
            <template v-for="row in pagedRows" :key="row.ip">
              <tr class="border-b transition-colors hover:bg-muted/30">
                <td class="px-4 py-3">
                  <Button variant="ghost" size="icon" class="size-8" :aria-label="row.expanded ? '收起文件' : '展开文件'" :aria-expanded="row.expanded" @click="toggleExpanded(row)">
                    <ChevronDown class="size-4 transition-transform" :class="row.expanded && 'rotate-180'" />
                  </Button>
                </td>
                <td class="px-4 py-3"><div class="flex items-center gap-2 font-mono text-xs"><span class="size-2 rounded-full" :class="row.allowed ? 'bg-emerald-500' : 'bg-destructive'" />{{ row.ip }}</div></td>
                <td class="px-4 py-3"><div class="flex items-center gap-2 text-muted-foreground"><MapPin class="size-4 shrink-0" /><span class="max-w-sm truncate">{{ row.address || '未知' }}</span></div></td>
                <td class="px-4 py-3 text-right font-medium tabular-nums">{{ row.count }}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-end gap-3">
                    <Badge :variant="row.allowed ? 'success' : 'destructive'">{{ row.allowed ? '允许' : '已禁止' }}</Badge>
                    <Switch :model-value="row.allowed" :disabled="busyIps.has(row.ip)" :aria-label="`${row.allowed ? '禁止' : '允许'} ${row.ip} 上传`" @update:model-value="setAllowed(row, $event)" />
                  </div>
                </td>
              </tr>
              <tr v-if="row.expanded" class="border-b bg-muted/20">
                <td colspan="5" class="p-4 sm:p-5">
                  <div class="mb-4 flex items-center justify-between gap-3">
                    <div><p class="font-medium">上传文件</p><p class="text-xs text-muted-foreground">已加载 {{ row.files.length }} / {{ row.fileTotal }} 个文件</p></div>
                    <Badge variant="outline"><ShieldCheck class="mr-1 size-3" />{{ row.allowed ? '允许上传' : '禁止上传' }}</Badge>
                  </div>
                  <div v-if="row.files.length" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <a v-for="file in row.files" :key="file.id || file.name" :href="fileUrl(file)" target="_blank" rel="noreferrer" class="group flex min-w-0 items-center gap-3 rounded-xl border bg-background p-3 transition hover:border-amber-500/45 hover:shadow-sm">
                      <img v-if="isImage(file)" :src="fileUrl(file)" :alt="displayName(file)" loading="lazy" class="size-12 shrink-0 rounded-lg border object-cover" />
                      <span v-else class="grid size-12 shrink-0 place-items-center rounded-lg bg-muted"><FileVideo v-if="isVideo(file)" class="size-5 text-muted-foreground" /><File v-else class="size-5 text-muted-foreground" /></span>
                      <span class="min-w-0"><span class="block truncate text-sm font-medium group-hover:underline">{{ displayName(file) }}</span><span class="mt-1 block text-xs text-muted-foreground">{{ formatDate(file.metadata?.TimeStamp) }}</span></span>
                    </a>
                  </div>
                  <div v-else-if="row.filesLoading" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Skeleton v-for="index in 4" :key="index" class="h-[74px] rounded-xl" /></div>
                  <p v-else class="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">该 IP 暂无可显示的文件。</p>
                  <div v-if="row.files.length < row.fileTotal" class="mt-4 text-center">
                    <Button variant="outline" size="sm" :disabled="row.filesLoading" @click="loadFiles(row)"><LoaderCircle v-if="row.filesLoading" class="animate-spin" /><ImageIcon v-else />加载更多文件</Button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="!loading && filteredRows.length" class="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs text-muted-foreground">第 {{ currentPage }} / {{ pageCount }} 页 · 当前已加载 {{ rows.length }} 个来源<span v-if="search">（搜索仅覆盖已加载数据）</span></p>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" :disabled="currentPage <= 1" @click="currentPage -= 1">上一页</Button>
          <Button variant="outline" size="sm" :disabled="currentPage >= pageCount && (!hasMore || !!search)" @click="nextPage">下一页</Button>
          <Button v-if="hasMore && !search" variant="secondary" size="sm" :disabled="loadingMore" @click="loadMoreCustomers"><LoaderCircle v-if="loadingMore" class="animate-spin" />继续加载</Button>
        </div>
      </div>
    </Card>
  </AdminShell>
</template>
