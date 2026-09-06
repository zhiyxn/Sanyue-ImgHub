<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { Database, Gauge, HardDrive, LoaderCircle, Pencil, Plus, RefreshCw, Server, Trash2, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import ConfirmDialog from './ConfirmDialog.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/services/api'
import type { StorageChannel, StorageChannelGroup, UploadChannelType, UploadSettings } from '@/types/api'

type StorageType = Exclude<UploadChannelType, 'external'>
type EditableChannel = StorageChannel & { headersText?: string }

const channelTypes: Array<{ value: StorageType; label: string; addable: boolean; loadBalance: boolean }> = [
  { value: 'telegram', label: 'Telegram', addable: true, loadBalance: true },
  { value: 'cfr2', label: 'Cloudflare R2', addable: false, loadBalance: false },
  { value: 's3', label: 'S3 兼容存储', addable: true, loadBalance: true },
  { value: 'discord', label: 'Discord', addable: true, loadBalance: true },
  { value: 'huggingface', label: 'Hugging Face', addable: true, loadBalance: true },
  { value: 'webdav', label: 'WebDAV', addable: true, loadBalance: true },
]

const reservedNames = new Set(['Telegram_env', 'R2_env', 'S3_env', 'Discord_env', 'HuggingFace_env', 'WebDAV_env'])
const quotaTypes = new Set<StorageType>(['cfr2', 's3', 'webdav'])
const settings = ref<UploadSettings>({})
const quotaStats = ref<Record<string, { usedMB?: number; count?: number }>>({})
const loading = ref(true)
const saving = ref(false)
const recalculating = ref(false)
const filter = ref<'all' | StorageType>('all')
const dialogOpen = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const currentType = ref<StorageType>('telegram')
const currentIndex = ref(-1)
const form = ref<EditableChannel>(makeEmptyChannel('telegram'))
const deleteOpen = ref(false)
const deleteTarget = ref<{ type: StorageType; index: number; channel: StorageChannel }>()

const visibleTypes = computed(() => filter.value === 'all' ? channelTypes : channelTypes.filter((item) => item.value === filter.value))
const credentialsLocked = computed(() => form.value.fixed === true)
const dialogTitle = computed(() => dialogMode.value === 'create' ? '添加存储渠道' : `编辑 ${form.value.name}`)

function group(type: StorageType): StorageChannelGroup {
  if (!settings.value[type]) settings.value[type] = { channels: [], loadBalance: { enabled: false, channels: [] } }
  return settings.value[type]!
}

function makeEmptyChannel(type: StorageType): EditableChannel {
  return {
    name: '', type, savePath: 'database', enabled: true, fixed: false,
    botToken: '', chatId: '', proxyUrl: '', publicUrl: '',
    endpoint: '', cdnDomain: '', bucketName: '', region: 'auto', accessKeyId: '', secretAccessKey: '', pathStyle: false,
    channelId: '', isNitro: false, repo: '', token: '', isPrivate: false,
    baseUrl: '', username: '', password: '', headers: {}, headersText: '', createDirectory: true,
    quota: { enabled: false, limitGB: 10, threshold: 95 },
  }
}

function normalizeSettings(value: UploadSettings) {
  settings.value = value
  for (const item of channelTypes) {
    const target = group(item.value)
    target.channels = (target.channels || []).map((channel, index) => ({
      ...channel,
      id: index + 1,
      enabled: channel.enabled !== false,
      quota: quotaTypes.has(item.value) ? (channel.quota || { enabled: false, limitGB: 10, threshold: 95 }) : channel.quota,
    }))
    target.loadBalance ||= { enabled: false, channels: [] }
  }
}

async function load() {
  loading.value = true
  try {
    const [upload, quota] = await Promise.all([api.getUploadSettings(), api.getQuotaStats()])
    normalizeSettings(upload)
    quotaStats.value = quota.quotaStats || {}
  } catch (reason) {
    toast.error(reason instanceof Error ? reason.message : '无法读取存储渠道')
  } finally {
    loading.value = false
  }
}

async function persist(successMessage = '存储渠道已保存') {
  saving.value = true
  try {
    normalizeSettings(await api.saveUploadSettings(settings.value))
    toast.success(successMessage)
    return true
  } catch (reason) {
    toast.error(reason instanceof Error ? reason.message : '保存存储渠道失败')
    await load()
    return false
  } finally {
    saving.value = false
  }
}

function mask(value?: string, visible = 4) {
  if (!value) return '未设置'
  if (value.length <= visible * 2) return '••••••••'
  return `${value.slice(0, visible)}••••${value.slice(-visible)}`
}

function channelDetail(channel: StorageChannel) {
  if (channel.type === 'telegram') return `Chat ${mask(channel.chatId)}`
  if (channel.type === 'cfr2') return channel.publicUrl || '未设置公开地址'
  if (channel.type === 's3') return [channel.bucketName, channel.region].filter(Boolean).join(' · ') || '未设置 Bucket'
  if (channel.type === 'discord') return `Channel ${mask(channel.channelId)}`
  if (channel.type === 'huggingface') return channel.repo || '未设置仓库'
  if (channel.type === 'webdav') return channel.baseUrl || '未设置服务地址'
  return '—'
}

function quotaPercent(channel: StorageChannel) {
  const usedGB = (quotaStats.value[channel.name]?.usedMB || 0) / 1024
  const limit = channel.quota?.limitGB || 10
  return Math.min(100, Math.round((usedGB / limit) * 1000) / 10)
}

function quotaText(channel: StorageChannel) {
  const usedGB = (quotaStats.value[channel.name]?.usedMB || 0) / 1024
  return `${usedGB.toFixed(2)} / ${channel.quota?.limitGB || 10} GB`
}

function openCreate() {
  dialogMode.value = 'create'
  currentType.value = filter.value === 'all' || filter.value === 'cfr2' ? 'telegram' : filter.value
  form.value = makeEmptyChannel(currentType.value)
  currentIndex.value = -1
  dialogOpen.value = true
}

function changeCreateType(value: string | number | undefined) {
  currentType.value = value as StorageType
  form.value = makeEmptyChannel(currentType.value)
}

function openEdit(type: StorageType, index: number) {
  dialogMode.value = 'edit'
  currentType.value = type
  currentIndex.value = index
  const channel = structuredClone(group(type).channels[index]) as EditableChannel
  channel.headersText = channel.headers ? JSON.stringify(channel.headers, null, 2) : ''
  channel.quota ||= { enabled: false, limitGB: 10, threshold: 95 }
  form.value = channel
  dialogOpen.value = true
}

function validateForm() {
  if (!form.value.name.trim()) return '请输入渠道名称'
  if (!/^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/.test(form.value.name)) return '渠道名称只能包含中英文、数字、下划线和连字符'
  if (dialogMode.value === 'create' && reservedNames.has(form.value.name)) return '该名称为环境变量渠道保留名称'
  if (dialogMode.value === 'create' && group(currentType.value).channels.some((item) => item.name === form.value.name)) return '同类型渠道名称不能重复'
  const required: Partial<Record<StorageType, Array<keyof StorageChannel>>> = {
    telegram: ['botToken', 'chatId'], s3: ['endpoint', 'bucketName', 'region', 'accessKeyId', 'secretAccessKey'],
    discord: ['botToken', 'channelId'], huggingface: ['repo', 'token'], webdav: ['baseUrl'],
  }
  if ((required[currentType.value] || []).some((key) => !String(form.value[key] || '').trim())) return '请填写该渠道的必填连接信息'
  return ''
}

function sanitizeChannel(source: EditableChannel): StorageChannel {
  const channel: StorageChannel = {
    id: source.id,
    name: source.name,
    type: currentType.value,
    savePath: source.savePath || 'database',
    enabled: source.enabled,
    fixed: source.fixed,
  }
  if (currentType.value === 'telegram') Object.assign(channel, { botToken: source.botToken, chatId: source.chatId, proxyUrl: source.proxyUrl })
  if (currentType.value === 'cfr2') Object.assign(channel, { publicUrl: source.publicUrl, quota: source.quota })
  if (currentType.value === 's3') Object.assign(channel, {
    endpoint: source.endpoint, cdnDomain: source.cdnDomain, bucketName: source.bucketName, region: source.region,
    accessKeyId: source.accessKeyId, secretAccessKey: source.secretAccessKey, pathStyle: source.pathStyle, quota: source.quota,
  })
  if (currentType.value === 'discord') Object.assign(channel, { botToken: source.botToken, channelId: source.channelId, proxyUrl: source.proxyUrl, isNitro: source.isNitro })
  if (currentType.value === 'huggingface') Object.assign(channel, { repo: source.repo, token: source.token, isPrivate: source.isPrivate })
  if (currentType.value === 'webdav') Object.assign(channel, {
    baseUrl: source.baseUrl, username: source.username, password: source.password, publicUrl: source.publicUrl,
    headers: source.headers, createDirectory: source.createDirectory, quota: source.quota,
  })
  return channel
}

async function saveForm() {
  const validationError = validateForm()
  if (validationError) return toast.error(validationError)
  const channel = structuredClone(form.value) as EditableChannel
  channel.type = currentType.value
  channel.name = dialogMode.value === 'edit' ? group(currentType.value).channels[currentIndex.value]!.name : channel.name.trim()
  if (currentType.value === 'webdav') {
    try {
      channel.headers = channel.headersText?.trim() ? JSON.parse(channel.headersText) as Record<string, string> : {}
      if (!channel.headers || Array.isArray(channel.headers) || typeof channel.headers !== 'object') throw new Error()
    } catch {
      return toast.error('WebDAV 请求头必须是有效的 JSON 对象')
    }
  }
  delete channel.headersText
  const sanitized = sanitizeChannel(channel)
  if (dialogMode.value === 'create') {
    sanitized.id = group(currentType.value).channels.length + 1
    group(currentType.value).channels.push(sanitized)
  } else {
    group(currentType.value).channels[currentIndex.value] = sanitized
  }
  if (await persist(dialogMode.value === 'create' ? '存储渠道已添加' : '存储渠道已更新')) dialogOpen.value = false
}

async function toggleEnabled(channel: StorageChannel, value: boolean) {
  channel.enabled = value
  await persist(value ? '渠道已启用' : '渠道已停用')
}

function askDelete(type: StorageType, index: number) {
  const channel = group(type).channels[index]!
  if (channel.fixed) return toast.error('环境变量渠道不能删除')
  deleteTarget.value = { type, index, channel }
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  const { type, index } = deleteTarget.value
  group(type).channels.splice(index, 1)
  group(type).channels.forEach((item, position) => { item.id = position + 1 })
  if (await persist('存储渠道已删除')) deleteOpen.value = false
}

async function recalculateQuota() {
  recalculating.value = true
  try {
    const result = await api.recalculateQuota()
    quotaStats.value = result.channelStats || result.quotaStats || {}
    toast.success('容量统计已重新计算')
  } catch (reason) {
    toast.error(reason instanceof Error ? reason.message : '容量统计失败')
  } finally {
    recalculating.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 class="font-semibold">存储渠道</h2><p class="mt-1 text-xs text-muted-foreground">管理上传目标、连接信息、启停状态与容量阈值。</p></div>
      <div class="flex flex-wrap gap-2">
        <Select v-model="filter"><SelectTrigger class="w-40"><SelectValue placeholder="筛选渠道" /></SelectTrigger><SelectContent><SelectItem value="all">全部渠道</SelectItem><SelectItem v-for="item in channelTypes" :key="item.value" :value="item.value">{{ item.label }}</SelectItem></SelectContent></Select>
        <Button variant="outline" :disabled="recalculating" @click="recalculateQuota"><RefreshCw :class="recalculating && 'animate-spin'" />刷新容量</Button>
        <Button @click="openCreate"><Plus />添加渠道</Button>
      </div>
    </div>

    <div v-if="loading" class="space-y-4"><Skeleton v-for="index in 4" :key="index" class="h-48 rounded-xl" /></div>
    <Card v-for="item in visibleTypes" v-else :key="item.value" class="overflow-hidden shadow-none">
      <div class="flex items-center justify-between gap-4 border-b p-5">
        <div class="flex items-center gap-3"><span class="grid size-9 place-items-center rounded-lg bg-muted"><Database v-if="item.value === 'cfr2'" class="size-4" /><Server v-else class="size-4" /></span><div><h3 class="font-semibold">{{ item.label }}</h3><p class="text-xs text-muted-foreground">{{ group(item.value).channels.length }} 个渠道</p></div></div>
        <div v-if="item.loadBalance" class="flex items-center gap-3"><span class="text-xs text-muted-foreground">负载均衡</span><Switch v-model="group(item.value).loadBalance!.enabled" :disabled="saving" @update:model-value="persist('负载均衡设置已保存')" /></div>
      </div>
      <div v-if="group(item.value).channels.length" class="grid gap-3 p-5 lg:grid-cols-2 xl:grid-cols-3">
        <div v-for="(channel, index) in group(item.value).channels" :key="channel.name" class="rounded-xl border bg-background p-4">
          <div class="flex items-start justify-between gap-3"><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><p class="truncate font-medium">{{ channel.name }}</p><Badge v-if="channel.fixed" variant="outline">环境变量</Badge><Badge :variant="channel.enabled ? 'success' : 'secondary'">{{ channel.enabled ? '可用' : '停用' }}</Badge></div><p class="mt-1 truncate text-xs text-muted-foreground">{{ channelDetail(channel) }}</p></div><Switch :model-value="channel.enabled" :disabled="saving" :aria-label="`${channel.enabled ? '停用' : '启用'} ${channel.name}`" @update:model-value="toggleEnabled(channel, $event)" /></div>
          <div v-if="channel.quota?.enabled" class="mt-4 rounded-lg bg-muted/35 p-3"><div class="mb-2 flex items-center justify-between text-xs"><span class="flex items-center gap-1 text-muted-foreground"><Gauge class="size-3.5" />容量</span><span>{{ quotaText(channel) }}</span></div><Progress :model-value="quotaPercent(channel)" /><p class="mt-2 text-xs" :class="quotaPercent(channel) >= (channel.quota.threshold || 95) ? 'text-destructive' : 'text-muted-foreground'">已使用 {{ quotaPercent(channel) }}% · 阈值 {{ channel.quota.threshold }}%</p></div>
          <div class="mt-4 flex justify-end gap-1 border-t pt-3"><Button variant="ghost" size="sm" @click="openEdit(item.value, index)"><Pencil />编辑</Button><Button variant="ghost" size="sm" class="text-destructive hover:text-destructive" :disabled="channel.fixed || saving" @click="askDelete(item.value, index)"><Trash2 />删除</Button></div>
        </div>
      </div>
      <div v-else class="p-8 text-center"><HardDrive class="mx-auto size-7 text-muted-foreground" /><p class="mt-2 text-sm text-muted-foreground">暂无 {{ item.label }} 渠道<span v-if="!item.addable">，R2 需要通过 Cloudflare 绑定配置</span></p></div>
    </Card>
  </section>

  <DialogRoot :open="dialogOpen" @update:open="dialogOpen = $event">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
      <DialogContent class="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l bg-background p-6 shadow-2xl sm:p-7">
        <div class="flex items-start justify-between gap-4"><div><DialogTitle class="text-xl font-semibold">{{ dialogTitle }}</DialogTitle><DialogDescription class="mt-1 text-sm text-muted-foreground">环境变量提供的凭据为只读，其他可变配置仍可保存。</DialogDescription></div><DialogClose as-child><Button variant="ghost" size="icon"><X /></Button></DialogClose></div>
        <div class="mt-7 space-y-5">
          <div v-if="dialogMode === 'create'" class="space-y-2"><Label for="storage-type">渠道类型</Label><Select :model-value="currentType" @update:model-value="changeCreateType"><SelectTrigger id="storage-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="item in channelTypes.filter((type) => type.addable)" :key="item.value" :value="item.value">{{ item.label }}</SelectItem></SelectContent></Select></div>
          <div class="space-y-2"><Label for="channel-name">渠道名称</Label><Input id="channel-name" v-model="form.name" :disabled="dialogMode === 'edit'" placeholder="唯一名称，例如 backup_s3" /></div>
          <div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">启用渠道</p><p class="text-xs text-muted-foreground">停用后不会参与上传与负载均衡</p></div><Switch v-model="form.enabled" /></div>

          <template v-if="currentType === 'telegram'"><div class="space-y-2"><Label>Bot Token</Label><Input v-model="form.botToken" type="password" :disabled="credentialsLocked" /></div><div class="space-y-2"><Label>Chat ID</Label><Input v-model="form.chatId" type="password" :disabled="credentialsLocked" /></div><div class="space-y-2"><Label>代理地址</Label><Input v-model="form.proxyUrl" placeholder="可选" /></div></template>
          <template v-else-if="currentType === 'cfr2'"><div class="space-y-2"><Label>公开访问地址</Label><Input v-model="form.publicUrl" placeholder="https://img.example.com" /></div></template>
          <template v-else-if="currentType === 's3'"><div class="space-y-2"><Label>Endpoint</Label><Input v-model="form.endpoint" :disabled="credentialsLocked" /></div><div class="space-y-2"><Label>CDN 域名</Label><Input v-model="form.cdnDomain" placeholder="可选" /></div><div class="grid gap-4 sm:grid-cols-2"><div class="space-y-2"><Label>Bucket</Label><Input v-model="form.bucketName" :disabled="credentialsLocked" /></div><div class="space-y-2"><Label>Region</Label><Input v-model="form.region" :disabled="credentialsLocked" /></div></div><div class="space-y-2"><Label>Access Key ID</Label><Input v-model="form.accessKeyId" type="password" :disabled="credentialsLocked" /></div><div class="space-y-2"><Label>Secret Access Key</Label><Input v-model="form.secretAccessKey" type="password" :disabled="credentialsLocked" /></div><div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">Path Style</p><p class="text-xs text-muted-foreground">使用路径风格的 Bucket 地址</p></div><Switch v-model="form.pathStyle" :disabled="credentialsLocked" /></div></template>
          <template v-else-if="currentType === 'discord'"><div class="space-y-2"><Label>Bot Token</Label><Input v-model="form.botToken" type="password" :disabled="credentialsLocked" /></div><div class="space-y-2"><Label>Channel ID</Label><Input v-model="form.channelId" type="password" :disabled="credentialsLocked" /></div><div class="space-y-2"><Label>代理地址</Label><Input v-model="form.proxyUrl" placeholder="可选" /></div><div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">Nitro</p><p class="text-xs text-muted-foreground">使用更大的单文件限制</p></div><Switch v-model="form.isNitro" /></div></template>
          <template v-else-if="currentType === 'huggingface'"><div class="space-y-2"><Label>仓库名称</Label><Input v-model="form.repo" :disabled="credentialsLocked" placeholder="owner/repository" /></div><div class="space-y-2"><Label>Access Token</Label><Input v-model="form.token" type="password" :disabled="credentialsLocked" /></div><div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">私有仓库</p><p class="text-xs text-muted-foreground">生成需要鉴权的访问地址</p></div><Switch v-model="form.isPrivate" /></div></template>
          <template v-else-if="currentType === 'webdav'"><div class="space-y-2"><Label>WebDAV 地址</Label><Input v-model="form.baseUrl" :disabled="credentialsLocked" /></div><div class="grid gap-4 sm:grid-cols-2"><div class="space-y-2"><Label>用户名</Label><Input v-model="form.username" :disabled="credentialsLocked" /></div><div class="space-y-2"><Label>密码</Label><Input v-model="form.password" type="password" :disabled="credentialsLocked" /></div></div><div class="space-y-2"><Label>公开访问地址</Label><Input v-model="form.publicUrl" placeholder="可选" /></div><div class="space-y-2"><Label>附加请求头（JSON）</Label><Textarea v-model="form.headersText" :rows="4" placeholder='{ "Authorization": "Bearer ..." }' /></div><div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">自动创建目录</p><p class="text-xs text-muted-foreground">上传前创建不存在的路径</p></div><Switch v-model="form.createDirectory" /></div></template>

          <div v-if="quotaTypes.has(currentType)" class="space-y-4 rounded-xl border bg-muted/20 p-4"><div class="flex items-center justify-between"><div><p class="text-sm font-medium">容量限制</p><p class="text-xs text-muted-foreground">达到阈值时暂停写入</p></div><Switch v-model="form.quota!.enabled" /></div><div v-if="form.quota?.enabled" class="grid gap-4 sm:grid-cols-2"><div class="space-y-2"><Label>容量上限（GB）</Label><Input v-model="form.quota.limitGB" type="number" min="0.1" step="0.1" /></div><div class="space-y-2"><Label>暂停阈值（%）</Label><Input v-model="form.quota.threshold" type="number" min="50" max="100" step="5" /></div></div></div>
        </div>
        <div class="mt-8 flex justify-end gap-2"><DialogClose as-child><Button variant="outline" :disabled="saving">取消</Button></DialogClose><Button :disabled="saving" @click="saveForm"><LoaderCircle v-if="saving" class="animate-spin" />{{ saving ? '保存中…' : '保存渠道' }}</Button></div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <ConfirmDialog v-model:open="deleteOpen" title="删除存储渠道？" :description="`将删除“${deleteTarget?.channel.name || ''}”的连接配置。已上传文件不会被删除。`" confirm-text="删除渠道" :busy="saving" @confirm="confirmDelete" />
</template>
