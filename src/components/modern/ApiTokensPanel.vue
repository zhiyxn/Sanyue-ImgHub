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
import { AlertTriangle, Clipboard, KeyRound, LoaderCircle, Pencil, Plus, Trash2, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import ConfirmDialog from './ConfirmDialog.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { api } from '@/services/api'
import { copyText, formatDate } from '@/lib/utils'
import type { ApiTokenPermission, ApiTokenRecord } from '@/types/api'

type ExpirationUnit = 'h' | 'd' | 'M' | 'Y'

const permissionOptions: Array<{ value: ApiTokenPermission; label: string; description: string }> = [
  { value: 'upload', label: '上传', description: '上传新文件' },
  { value: 'list', label: '读取', description: '查看文件列表' },
  { value: 'delete', label: '删除', description: '删除已有文件' },
  { value: 'manage', label: '管理', description: '调用管理接口' },
]

const tokens = ref<ApiTokenRecord[]>([])
const loading = ref(true)
const saving = ref(false)
const dialogOpen = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingId = ref('')
const name = ref('')
const permissions = ref<ApiTokenPermission[]>([])
const neverExpire = ref(true)
const expirationValue = ref(1)
const expirationUnit = ref<ExpirationUnit>('M')
const autoDelete = ref(false)
const createdToken = ref<ApiTokenRecord>()
const resultOpen = ref(false)
const deleteOpen = ref(false)
const deleting = ref(false)
const deleteTarget = ref<ApiTokenRecord>()

const dialogTitle = computed(() => dialogMode.value === 'create' ? '创建 API Token' : '编辑 API Token')

function computeExpiresAt() {
  if (neverExpire.value) return null
  const value = Math.max(1, Number(expirationValue.value) || 1)
  const date = new Date()
  if (expirationUnit.value === 'h') date.setTime(date.getTime() + value * 60 * 60 * 1000)
  if (expirationUnit.value === 'd') date.setUTCDate(date.getUTCDate() + value)
  if (expirationUnit.value === 'M') date.setUTCMonth(date.getUTCMonth() + value)
  if (expirationUnit.value === 'Y') date.setUTCFullYear(date.getUTCFullYear() + value)
  return date.toISOString()
}

function tokenStatus(token: ApiTokenRecord) {
  if (!token.expiresAt) return { label: '有效', detail: '永不过期', active: true }
  const active = Date.now() <= new Date(token.expiresAt).getTime()
  return { label: active ? '有效' : '已过期', detail: formatDate(token.expiresAt), active }
}

function permissionLabel(permission: ApiTokenPermission) {
  return permissionOptions.find((item) => item.value === permission)?.label || permission
}

function togglePermission(permission: ApiTokenPermission) {
  permissions.value = permissions.value.includes(permission)
    ? permissions.value.filter((item) => item !== permission)
    : [...permissions.value, permission]
}

async function loadTokens() {
  loading.value = true
  try {
    tokens.value = await api.apiTokens()
  } catch (reason) {
    toast.error(reason instanceof Error ? reason.message : '无法读取 API Token')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  dialogMode.value = 'create'
  editingId.value = ''
  name.value = ''
  permissions.value = ['upload']
  neverExpire.value = true
  expirationValue.value = 1
  expirationUnit.value = 'M'
  autoDelete.value = false
  dialogOpen.value = true
}

function openEdit(token: ApiTokenRecord) {
  dialogMode.value = 'edit'
  editingId.value = token.id
  name.value = token.name
  permissions.value = [...token.permissions]
  neverExpire.value = !token.expiresAt
  expirationValue.value = 1
  expirationUnit.value = 'M'
  autoDelete.value = token.autoDelete
  dialogOpen.value = true
}

async function saveToken() {
  if (!name.value.trim()) return toast.error('请输入 Token 名称')
  if (!permissions.value.length) return toast.error('请至少选择一项权限')
  saving.value = true
  const expiresAt = computeExpiresAt()
  try {
    if (dialogMode.value === 'create') {
      createdToken.value = await api.createApiToken({
        name: name.value.trim(),
        owner: 'admin',
        permissions: permissions.value,
        expiresAt,
        autoDelete: expiresAt ? autoDelete.value : false,
      })
      resultOpen.value = true
      toast.success('API Token 已创建')
    } else {
      await api.updateApiToken(editingId.value, {
        permissions: permissions.value,
        expiresAt,
        autoDelete: expiresAt ? autoDelete.value : false,
      })
      toast.success('API Token 已更新')
    }
    dialogOpen.value = false
    await loadTokens()
  } catch (reason) {
    toast.error(reason instanceof Error ? reason.message : '保存 Token 失败')
  } finally {
    saving.value = false
  }
}

function askDelete(token: ApiTokenRecord) {
  deleteTarget.value = token
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.deleteApiToken(deleteTarget.value.id)
    toast.success('API Token 已删除')
    deleteOpen.value = false
    await loadTokens()
  } catch (reason) {
    toast.error(reason instanceof Error ? reason.message : '删除 Token 失败')
  } finally {
    deleting.value = false
  }
}

async function copyCreatedToken() {
  if (!createdToken.value) return
  await copyText(createdToken.value.token)
  toast.success('完整 Token 已复制')
}

onMounted(loadTokens)
</script>

<template>
  <Card class="overflow-hidden shadow-none">
    <div class="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex gap-3">
        <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><KeyRound class="size-4" /></span>
        <div><h2 class="font-semibold">API Token</h2><p class="mt-1 text-xs text-muted-foreground">为第三方客户端创建独立凭据，并限制其接口权限。</p></div>
      </div>
      <Button size="sm" @click="openCreate"><Plus />创建 Token</Button>
    </div>

    <div v-if="loading" class="space-y-2 p-5"><Skeleton v-for="index in 3" :key="index" class="h-16 rounded-lg" /></div>
    <div v-else-if="!tokens.length" class="p-8 text-center"><KeyRound class="mx-auto size-8 text-muted-foreground" /><p class="mt-3 text-sm font-medium">还没有 API Token</p><p class="mt-1 text-xs text-muted-foreground">按用途分别创建 Token，避免共享管理员密码。</p></div>
    <div v-else class="overflow-x-auto">
      <table class="w-full min-w-[840px] text-left text-sm">
        <thead class="border-b bg-muted/45 text-xs text-muted-foreground"><tr><th class="px-5 py-3 font-medium">名称与 Token</th><th class="px-5 py-3 font-medium">权限</th><th class="px-5 py-3 font-medium">创建时间</th><th class="px-5 py-3 font-medium">状态与有效期</th><th class="px-5 py-3 text-right font-medium">操作</th></tr></thead>
        <tbody>
          <tr v-for="token in tokens" :key="token.id" class="border-b last:border-b-0 hover:bg-muted/25">
            <td class="px-5 py-4"><p class="font-medium">{{ token.name }}</p><p class="mt-1 font-mono text-xs text-muted-foreground">{{ token.token }}</p></td>
            <td class="px-5 py-4"><div class="flex flex-wrap gap-1"><Badge v-for="permission in token.permissions" :key="permission" variant="secondary">{{ permissionLabel(permission) }}</Badge></div></td>
            <td class="px-5 py-4 text-xs text-muted-foreground">{{ formatDate(token.createdAt) }}</td>
            <td class="px-5 py-4"><div class="flex items-center gap-2"><Badge :variant="tokenStatus(token).active ? 'success' : 'destructive'">{{ tokenStatus(token).label }}</Badge><span class="text-xs text-muted-foreground">{{ tokenStatus(token).detail }}</span></div><p v-if="token.autoDelete" class="mt-1 text-xs text-muted-foreground">过期后自动删除</p></td>
            <td class="px-5 py-4"><div class="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label="编辑 Token" @click="openEdit(token)"><Pencil /></Button><Button variant="ghost" size="icon" class="text-destructive hover:text-destructive" aria-label="删除 Token" @click="askDelete(token)"><Trash2 /></Button></div></td>
          </tr>
        </tbody>
      </table>
    </div>
  </Card>

  <DialogRoot :open="dialogOpen" @update:open="dialogOpen = $event">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
      <DialogContent class="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl">
        <div class="flex items-start justify-between gap-4"><div><DialogTitle class="text-lg font-semibold">{{ dialogTitle }}</DialogTitle><DialogDescription class="mt-1 text-sm text-muted-foreground">Token 的完整值只会在创建后显示一次。</DialogDescription></div><DialogClose as-child><Button variant="ghost" size="icon"><X /></Button></DialogClose></div>
        <div class="mt-6 space-y-5">
          <div class="space-y-2"><Label for="token-name">Token 名称</Label><Input id="token-name" v-model="name" :disabled="dialogMode === 'edit'" placeholder="例如 PicGo 桌面端" /></div>
          <div class="space-y-2"><Label>接口权限</Label><div class="grid gap-2 sm:grid-cols-2"><button v-for="item in permissionOptions" :key="item.value" type="button" class="rounded-lg border p-3 text-left transition" :class="permissions.includes(item.value) ? 'border-amber-500/60 bg-amber-500/10' : 'hover:bg-muted/40'" @click="togglePermission(item.value)"><span class="text-sm font-medium">{{ item.label }}</span><span class="mt-0.5 block text-xs text-muted-foreground">{{ item.description }}</span></button></div></div>
          <div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">永不过期</p><p class="text-xs text-muted-foreground">关闭后可设置新的有效时长</p></div><Switch v-model="neverExpire" @update:model-value="$event && (autoDelete = false)" /></div>
          <div v-if="!neverExpire" class="space-y-4 rounded-lg border bg-muted/20 p-4">
            <div class="grid grid-cols-[minmax(0,1fr)_140px] gap-3"><div class="space-y-2"><Label for="expiry-value">有效时长</Label><Input id="expiry-value" v-model="expirationValue" type="number" min="1" /></div><div class="space-y-2"><Label for="expiry-unit">单位</Label><Select v-model="expirationUnit"><SelectTrigger id="expiry-unit"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="h">小时</SelectItem><SelectItem value="d">天</SelectItem><SelectItem value="M">月</SelectItem><SelectItem value="Y">年</SelectItem></SelectContent></Select></div></div>
            <div class="flex items-center justify-between"><div><p class="text-sm font-medium">过期后自动删除</p><p class="text-xs text-muted-foreground">否则保留过期记录以便审计</p></div><Switch v-model="autoDelete" /></div>
          </div>
        </div>
        <div class="mt-7 flex justify-end gap-2"><DialogClose as-child><Button variant="outline" :disabled="saving">取消</Button></DialogClose><Button :disabled="saving" @click="saveToken"><LoaderCircle v-if="saving" class="animate-spin" />{{ dialogMode === 'create' ? '创建 Token' : '保存更改' }}</Button></div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <DialogRoot :open="resultOpen" @update:open="resultOpen = $event">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
      <DialogContent class="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <DialogTitle class="text-lg font-semibold">API Token 已创建</DialogTitle><DialogDescription class="mt-1 text-sm text-muted-foreground">请立即复制并保存在安全位置。</DialogDescription>
        <div class="mt-5 flex gap-3 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-sm"><AlertTriangle class="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" /><p>关闭后将无法再次查看完整 Token，只能重新创建。</p></div>
        <div v-if="createdToken" class="mt-5 space-y-2"><Label>完整 Token</Label><div class="flex gap-2"><Input :model-value="createdToken.token" readonly class="font-mono text-xs" /><Button variant="outline" @click="copyCreatedToken"><Clipboard />复制</Button></div></div>
        <div class="mt-6 flex justify-end"><DialogClose as-child><Button>我已保存</Button></DialogClose></div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <ConfirmDialog v-model:open="deleteOpen" title="删除 API Token？" :description="`将删除“${deleteTarget?.name || ''}”，使用该 Token 的客户端会立即失效。`" confirm-text="删除 Token" :busy="deleting" @confirm="confirmDelete" />
</template>
