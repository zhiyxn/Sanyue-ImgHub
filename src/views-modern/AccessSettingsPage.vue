<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CloudCog, Dice5, Globe2, LoaderCircle, RadioTower, Save, ShieldCheck } from '@lucide/vue'
import { toast } from 'vue-sonner'
import AdminShell from '@/components/modern/AdminShell.vue'
import PageHeading from '@/components/modern/PageHeading.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/services/api'
import type { ChannelMap, UploadChannelType } from '@/types/api'

interface CloudflareApiTokenSettings {
  CF_ZONE_ID: string
  CF_EMAIL: string
  CF_API_KEY: string
  fixed?: boolean
}

interface OtherSettings {
  telemetry: { enabled: boolean; fixed?: boolean }
  randomImageAPI: { enabled: boolean; allowedDir: string; fixed?: boolean }
  publicBrowse: { enabled: boolean; allowedDir: string; fixed?: boolean }
  webDAV: { enabled: boolean; username: string; password: string; uploadChannel: string; channelName: string; internalToken?: string; internalTokenId?: string; fixed?: boolean }
  cloudflareApiToken: CloudflareApiTokenSettings
  [key: string]: unknown
}

const channelLabels: Record<UploadChannelType, string> = {
  telegram: 'Telegram',
  cfr2: 'Cloudflare R2',
  s3: 'S3',
  discord: 'Discord',
  huggingface: 'Hugging Face',
  webdav: 'WebDAV',
  external: '外部链接',
}

const loading = ref(true)
const saving = ref(false)
const settings = ref<OtherSettings>()
const channels = ref<ChannelMap>({})
const availableChannelTypes = computed(() => (
  (Object.keys(channels.value) as UploadChannelType[])
    .filter((type) => type !== 'external' && (channels.value[type]?.length || 0) > 0)
))
const selectedChannelNames = computed(() => {
  const type = settings.value?.webDAV.uploadChannel as UploadChannelType | undefined
  return type ? channels.value[type] || [] : []
})

onMounted(async () => {
  try {
    const [otherSettings, availableChannels] = await Promise.all([
      api.getOtherSettings(),
      api.channels(),
    ])
    settings.value = otherSettings as unknown as OtherSettings
    channels.value = availableChannels
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '配置加载失败')
  } finally {
    loading.value = false
  }
})

async function save() {
  if (!settings.value) return
  saving.value = true
  try {
    settings.value = await api.saveOtherSettings(settings.value) as unknown as OtherSettings
    toast.success('访问规则已保存')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function changeWebDavChannel(value: unknown) {
  if (!settings.value || typeof value !== 'string') return
  settings.value.webDAV.uploadChannel = value
  settings.value.webDAV.channelName = ''
}
</script>

<template>
  <AdminShell title="访问规则" description="公开浏览、随机图片 API、WebDAV 与平台接口">
    <div class="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <PageHeading eyebrow="Access" title="访问规则" description="控制公开浏览、随机图片接口、WebDAV、遥测与 Cloudflare 接口权限。" />
      <Button :disabled="saving || loading || !settings" @click="save"><LoaderCircle v-if="saving" class="animate-spin" /><Save v-else />{{ saving ? '保存中…' : '保存更改' }}</Button>
    </div>
    <div v-if="loading" class="grid gap-4 lg:grid-cols-2"><Skeleton v-for="index in 5" :key="index" class="h-52 rounded-xl" /></div>
    <div v-else-if="settings" class="grid items-start gap-5 lg:grid-cols-2">
      <Card class="p-5 shadow-none">
        <div class="flex items-start justify-between gap-4"><div class="flex gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><Globe2 class="size-4" /></span><div><div class="flex items-center gap-2"><h2 class="font-semibold">公开文件浏览</h2><Badge v-if="settings.publicBrowse.fixed" variant="secondary">环境变量</Badge></div><p class="mt-1 text-xs leading-5 text-muted-foreground">允许访客通过 /browse 查看指定目录。</p></div></div><Switch v-model="settings.publicBrowse.enabled" :disabled="settings.publicBrowse.fixed" /></div>
        <div class="mt-5 space-y-2"><Label for="public-dirs">允许的目录</Label><Input id="public-dirs" v-model="settings.publicBrowse.allowedDir" :disabled="settings.publicBrowse.fixed" placeholder="public, photos 或 *" /><p class="text-xs text-muted-foreground">多个目录使用英文逗号分隔，* 表示全部目录。</p></div>
      </Card>
      <Card class="p-5 shadow-none">
        <div class="flex items-start justify-between gap-4"><div class="flex gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><Dice5 class="size-4" /></span><div><div class="flex items-center gap-2"><h2 class="font-semibold">随机图片 API</h2><Badge v-if="settings.randomImageAPI.fixed" variant="secondary">环境变量</Badge></div><p class="mt-1 text-xs leading-5 text-muted-foreground">从允许目录中随机返回图片。</p></div></div><Switch v-model="settings.randomImageAPI.enabled" :disabled="settings.randomImageAPI.fixed" /></div>
        <div class="mt-5 space-y-2"><Label for="random-dirs">允许的目录</Label><Input id="random-dirs" v-model="settings.randomImageAPI.allowedDir" :disabled="settings.randomImageAPI.fixed" placeholder="wallpapers, photos" /></div>
      </Card>
      <Card class="p-5 shadow-none">
        <div class="flex items-start justify-between gap-4"><div class="flex gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><RadioTower class="size-4" /></span><div><div class="flex items-center gap-2"><h2 class="font-semibold">匿名遥测</h2><Badge v-if="settings.telemetry.fixed" variant="secondary">环境变量</Badge></div><p class="mt-1 text-xs leading-5 text-muted-foreground">控制项目的匿名使用统计。关闭不影响核心功能。</p></div></div><Switch v-model="settings.telemetry.enabled" :disabled="settings.telemetry.fixed" /></div>
      </Card>
      <Card class="p-5 shadow-none">
        <div class="flex items-start justify-between gap-4"><div class="flex gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><ShieldCheck class="size-4" /></span><div><div class="flex items-center gap-2"><h2 class="font-semibold">WebDAV 服务</h2><Badge v-if="settings.webDAV.fixed" variant="secondary">环境变量</Badge></div><p class="mt-1 text-xs leading-5 text-muted-foreground">将 ImgHub 作为 WebDAV 存储使用。</p></div></div><Switch v-model="settings.webDAV.enabled" :disabled="settings.webDAV.fixed" /></div>
        <div v-if="settings.webDAV.enabled" class="mt-5 grid gap-4 sm:grid-cols-2">
          <div class="space-y-2"><Label for="dav-user">用户名</Label><Input id="dav-user" v-model="settings.webDAV.username" :disabled="settings.webDAV.fixed" autocomplete="username" /></div>
          <div class="space-y-2"><Label for="dav-pass">密码</Label><Input id="dav-pass" v-model="settings.webDAV.password" :disabled="settings.webDAV.fixed" type="password" autocomplete="new-password" /></div>
          <div class="space-y-2"><Label for="dav-channel">上传渠道</Label><Select :model-value="settings.webDAV.uploadChannel" :disabled="settings.webDAV.fixed" @update:model-value="changeWebDavChannel"><SelectTrigger id="dav-channel"><SelectValue placeholder="跟随站点默认渠道" /></SelectTrigger><SelectContent><SelectItem v-for="type in availableChannelTypes" :key="type" :value="type">{{ channelLabels[type] }}</SelectItem></SelectContent></Select></div>
          <div v-if="settings.webDAV.uploadChannel && selectedChannelNames.length > 1" class="space-y-2"><Label for="dav-channel-name">渠道名称</Label><Select v-model="settings.webDAV.channelName" :disabled="settings.webDAV.fixed"><SelectTrigger id="dav-channel-name"><SelectValue placeholder="自动选择可用渠道" /></SelectTrigger><SelectContent><SelectItem v-for="channel in selectedChannelNames" :key="channel.name" :value="channel.name">{{ channel.name }}</SelectItem></SelectContent></Select></div>
          <p v-if="!availableChannelTypes.length" class="text-xs text-muted-foreground sm:col-span-2">暂未检测到可用存储渠道，请先到系统设置中配置并启用渠道。</p>
        </div>
      </Card>
      <Card class="p-5 shadow-none lg:col-span-2">
        <div class="flex gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400"><CloudCog class="size-4" /></span><div><div class="flex items-center gap-2"><h2 class="font-semibold">Cloudflare API 凭据</h2><Badge v-if="settings.cloudflareApiToken.fixed" variant="secondary">环境变量</Badge></div><p class="mt-1 text-xs leading-5 text-muted-foreground">用于需要调用 Cloudflare API 的管理操作。建议使用权限受限的 API Token，不要在公共设备保存。</p></div></div>
        <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div class="space-y-2"><Label for="cf-zone-id">Zone ID</Label><Input id="cf-zone-id" v-model="settings.cloudflareApiToken.CF_ZONE_ID" :disabled="settings.cloudflareApiToken.fixed" autocomplete="off" /></div>
          <div class="space-y-2"><Label for="cf-email">账户邮箱</Label><Input id="cf-email" v-model="settings.cloudflareApiToken.CF_EMAIL" :disabled="settings.cloudflareApiToken.fixed" type="email" autocomplete="off" /></div>
          <div class="space-y-2"><Label for="cf-api-key">API Key / Token</Label><Input id="cf-api-key" v-model="settings.cloudflareApiToken.CF_API_KEY" :disabled="settings.cloudflareApiToken.fixed" type="password" autocomplete="new-password" /></div>
        </div>
      </Card>
    </div>
  </AdminShell>
</template>
