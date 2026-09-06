<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
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

const { t } = useI18n()
const permissionOptions = computed<Array<{ value: ApiTokenPermission; label: string; description: string }>>(() => [
  { value: 'upload', label: t('modern.tokens.upload'), description: t('modern.tokens.uploadHint') },
  { value: 'list', label: t('modern.tokens.list'), description: t('modern.tokens.listHint') },
  { value: 'delete', label: t('modern.tokens.delete'), description: t('modern.tokens.deleteHint') },
  { value: 'manage', label: t('modern.tokens.manage'), description: t('modern.tokens.manageHint') },
])

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

const dialogTitle = computed(() => t(dialogMode.value === 'create' ? 'modern.tokens.create' : 'modern.tokens.edit'))

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
  if (!token.expiresAt) return { label: t('modern.tokens.valid'), detail: t('modern.tokens.never'), active: true }
  const active = Date.now() <= new Date(token.expiresAt).getTime()
  return { label: t(active ? 'modern.tokens.valid' : 'modern.tokens.expired'), detail: formatDate(token.expiresAt), active }
}

function permissionLabel(permission: ApiTokenPermission) {
  return permissionOptions.value.find((item) => item.value === permission)?.label || permission
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
    toast.error(reason instanceof Error ? reason.message : t('modern.tokens.loadFailed'))
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
  if (!name.value.trim()) return toast.error(t('modern.tokens.needName'))
  if (!permissions.value.length) return toast.error(t('modern.tokens.needPermission'))
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
      toast.success(t('modern.tokens.createdToast'))
    } else {
      await api.updateApiToken(editingId.value, {
        permissions: permissions.value,
        expiresAt,
        autoDelete: expiresAt ? autoDelete.value : false,
      })
      toast.success(t('modern.tokens.updatedToast'))
    }
    dialogOpen.value = false
    await loadTokens()
  } catch (reason) {
    toast.error(reason instanceof Error ? reason.message : t('modern.tokens.saveFailed'))
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
    toast.success(t('modern.tokens.deletedToast'))
    deleteOpen.value = false
    await loadTokens()
  } catch (reason) {
    toast.error(reason instanceof Error ? reason.message : t('modern.tokens.deleteFailed'))
  } finally {
    deleting.value = false
  }
}

async function copyCreatedToken() {
  if (!createdToken.value) return
  await copyText(createdToken.value.token)
  toast.success(t('modern.tokens.copiedToast'))
}

onMounted(loadTokens)
</script>

<template>
  <Card class="overflow-hidden shadow-none">
    <div class="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex gap-3">
        <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><KeyRound class="size-4" /></span>
        <div><h2 class="font-semibold">{{ t('modern.tokens.title') }}</h2><p class="mt-1 text-xs text-muted-foreground">{{ t('modern.tokens.description') }}</p></div>
      </div>
      <Button size="sm" @click="openCreate"><Plus />{{ t('modern.tokens.create') }}</Button>
    </div>

    <div v-if="loading" class="space-y-2 p-5"><Skeleton v-for="index in 3" :key="index" class="h-16 rounded-lg" /></div>
    <div v-else-if="!tokens.length" class="p-8 text-center"><KeyRound class="mx-auto size-8 text-muted-foreground" /><p class="mt-3 text-sm font-medium">{{ t('modern.tokens.empty') }}</p><p class="mt-1 text-xs text-muted-foreground">{{ t('modern.tokens.emptyHint') }}</p></div>
    <div v-else class="overflow-x-auto">
      <table class="w-full min-w-[840px] text-left text-sm">
        <thead class="border-b bg-muted/45 text-xs text-muted-foreground"><tr><th class="px-5 py-3 font-medium">{{ t('modern.tokens.nameToken') }}</th><th class="px-5 py-3 font-medium">{{ t('modern.tokens.permissions') }}</th><th class="px-5 py-3 font-medium">{{ t('modern.tokens.createdAt') }}</th><th class="px-5 py-3 font-medium">{{ t('modern.tokens.statusExpiry') }}</th><th class="px-5 py-3 text-right font-medium">{{ t('modern.tokens.actions') }}</th></tr></thead>
        <tbody>
          <tr v-for="token in tokens" :key="token.id" class="border-b last:border-b-0 hover:bg-muted/25">
            <td class="px-5 py-4"><p class="font-medium">{{ token.name }}</p><p class="mt-1 font-mono text-xs text-muted-foreground">{{ token.token }}</p></td>
            <td class="px-5 py-4"><div class="flex flex-wrap gap-1"><Badge v-for="permission in token.permissions" :key="permission" variant="secondary">{{ permissionLabel(permission) }}</Badge></div></td>
            <td class="px-5 py-4 text-xs text-muted-foreground">{{ formatDate(token.createdAt) }}</td>
            <td class="px-5 py-4"><div class="flex items-center gap-2"><Badge :variant="tokenStatus(token).active ? 'success' : 'destructive'">{{ tokenStatus(token).label }}</Badge><span class="text-xs text-muted-foreground">{{ tokenStatus(token).detail }}</span></div><p v-if="token.autoDelete" class="mt-1 text-xs text-muted-foreground">{{ t('modern.tokens.autoDeleteBadge') }}</p></td>
            <td class="px-5 py-4"><div class="flex justify-end gap-1"><Button variant="ghost" size="icon" :aria-label="t('modern.tokens.editAction')" @click="openEdit(token)"><Pencil /></Button><Button variant="ghost" size="icon" class="text-destructive hover:text-destructive" :aria-label="t('modern.tokens.deleteAction')" @click="askDelete(token)"><Trash2 /></Button></div></td>
          </tr>
        </tbody>
      </table>
    </div>
  </Card>

  <DialogRoot :open="dialogOpen" @update:open="dialogOpen = $event">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
      <DialogContent class="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl">
        <div class="flex items-start justify-between gap-4"><div><DialogTitle class="text-lg font-semibold">{{ dialogTitle }}</DialogTitle><DialogDescription class="mt-1 text-sm text-muted-foreground">{{ t('modern.tokens.oneTime') }}</DialogDescription></div><DialogClose as-child><Button variant="ghost" size="icon"><X /></Button></DialogClose></div>
        <div class="mt-6 space-y-5">
          <div class="space-y-2"><Label for="token-name">{{ t('modern.tokens.name') }}</Label><Input id="token-name" v-model="name" :disabled="dialogMode === 'edit'" :placeholder="t('modern.tokens.namePlaceholder')" /></div>
          <div class="space-y-2"><Label>{{ t('modern.tokens.apiPermissions') }}</Label><div class="grid gap-2 sm:grid-cols-2"><button v-for="item in permissionOptions" :key="item.value" type="button" class="rounded-lg border p-3 text-left transition" :class="permissions.includes(item.value) ? 'border-amber-500/60 bg-amber-500/10' : 'hover:bg-muted/40'" @click="togglePermission(item.value)"><span class="text-sm font-medium">{{ item.label }}</span><span class="mt-0.5 block text-xs text-muted-foreground">{{ item.description }}</span></button></div></div>
          <div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">{{ t('modern.tokens.neverExpire') }}</p><p class="text-xs text-muted-foreground">{{ t('modern.tokens.neverExpireHint') }}</p></div><Switch v-model="neverExpire" @update:model-value="$event && (autoDelete = false)" /></div>
          <div v-if="!neverExpire" class="space-y-4 rounded-lg border bg-muted/20 p-4">
            <div class="grid grid-cols-[minmax(0,1fr)_140px] gap-3"><div class="space-y-2"><Label for="expiry-value">{{ t('modern.tokens.duration') }}</Label><Input id="expiry-value" v-model="expirationValue" type="number" min="1" /></div><div class="space-y-2"><Label for="expiry-unit">{{ t('modern.tokens.unit') }}</Label><Select v-model="expirationUnit"><SelectTrigger id="expiry-unit"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="h">{{ t('modern.tokens.hour') }}</SelectItem><SelectItem value="d">{{ t('modern.tokens.day') }}</SelectItem><SelectItem value="M">{{ t('modern.tokens.month') }}</SelectItem><SelectItem value="Y">{{ t('modern.tokens.year') }}</SelectItem></SelectContent></Select></div></div>
            <div class="flex items-center justify-between"><div><p class="text-sm font-medium">{{ t('modern.tokens.autoDelete') }}</p><p class="text-xs text-muted-foreground">{{ t('modern.tokens.autoDeleteHint') }}</p></div><Switch v-model="autoDelete" /></div>
          </div>
        </div>
        <div class="mt-7 flex justify-end gap-2"><DialogClose as-child><Button variant="outline" :disabled="saving">{{ t('modern.tokens.cancel') }}</Button></DialogClose><Button :disabled="saving" @click="saveToken"><LoaderCircle v-if="saving" class="animate-spin" />{{ t(dialogMode === 'create' ? 'modern.tokens.create' : 'modern.tokens.save') }}</Button></div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <DialogRoot :open="resultOpen" @update:open="resultOpen = $event">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
      <DialogContent class="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <DialogTitle class="text-lg font-semibold">{{ t('modern.tokens.createdTitle') }}</DialogTitle><DialogDescription class="mt-1 text-sm text-muted-foreground">{{ t('modern.tokens.createdHint') }}</DialogDescription>
        <div class="mt-5 flex gap-3 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-sm"><AlertTriangle class="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" /><p>{{ t('modern.tokens.createdWarning') }}</p></div>
        <div v-if="createdToken" class="mt-5 space-y-2"><Label>{{ t('modern.tokens.fullToken') }}</Label><div class="flex gap-2"><Input :model-value="createdToken.token" readonly class="font-mono text-xs" /><Button variant="outline" @click="copyCreatedToken"><Clipboard />{{ t('modern.tokens.copy') }}</Button></div></div>
        <div class="mt-6 flex justify-end"><DialogClose as-child><Button>{{ t('modern.tokens.savedIt') }}</Button></DialogClose></div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <ConfirmDialog v-model:open="deleteOpen" :title="t('modern.tokens.deleteTitle')" :description="t('modern.tokens.deleteDescription', { name: deleteTarget?.name || '' })" :confirm-text="t('modern.tokens.deleteConfirm')" :busy="deleting" @confirm="confirmDelete" />
</template>
