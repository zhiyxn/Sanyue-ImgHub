<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Dice5, Globe2, LoaderCircle, RadioTower, Save, ShieldCheck } from '@lucide/vue'
import { toast } from 'vue-sonner'
import AppShell from '@/components/modern/AppShell.vue'
import PageHeading from '@/components/modern/PageHeading.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/services/api'

interface OtherSettings {
  telemetry: { enabled: boolean; fixed?: boolean }
  randomImageAPI: { enabled: boolean; allowedDir: string; fixed?: boolean }
  publicBrowse: { enabled: boolean; allowedDir: string; fixed?: boolean }
  webDAV: { enabled: boolean; username: string; password: string; uploadChannel: string; channelName: string; internalToken?: string; internalTokenId?: string; fixed?: boolean }
  cloudflareApiToken?: Record<string, unknown>
  [key: string]: unknown
}

const loading = ref(true)
const saving = ref(false)
const settings = ref<OtherSettings>()

onMounted(async () => {
  try {
    settings.value = await api.getOtherSettings() as unknown as OtherSettings
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
</script>

<template>
  <AppShell admin>
    <div class="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <PageHeading eyebrow="Access" title="访问规则" description="控制公开浏览、随机图片接口、WebDAV 和遥测。" />
      <Button :disabled="saving || loading || !settings" @click="save"><LoaderCircle v-if="saving" class="animate-spin" /><Save v-else />{{ saving ? '保存中…' : '保存更改' }}</Button>
    </div>
    <div v-if="loading" class="grid gap-4 lg:grid-cols-2"><Skeleton v-for="index in 4" :key="index" class="h-52 rounded-xl" /></div>
    <div v-else-if="settings" class="grid items-start gap-5 lg:grid-cols-2">
      <Card class="p-5 shadow-none">
        <div class="flex items-start justify-between gap-4"><div class="flex gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><Globe2 class="size-4" /></span><div><h2 class="font-semibold">公开文件浏览</h2><p class="mt-1 text-xs leading-5 text-muted-foreground">允许访客通过 /browse 查看指定目录。</p></div></div><Switch v-model="settings.publicBrowse.enabled" /></div>
        <div class="mt-5 space-y-2"><Label for="public-dirs">允许的目录</Label><Input id="public-dirs" v-model="settings.publicBrowse.allowedDir" placeholder="public, photos 或 *" /><p class="text-xs text-muted-foreground">多个目录使用英文逗号分隔，* 表示全部目录。</p></div>
      </Card>
      <Card class="p-5 shadow-none">
        <div class="flex items-start justify-between gap-4"><div class="flex gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><Dice5 class="size-4" /></span><div><h2 class="font-semibold">随机图片 API</h2><p class="mt-1 text-xs leading-5 text-muted-foreground">从允许目录中随机返回图片。</p></div></div><Switch v-model="settings.randomImageAPI.enabled" /></div>
        <div class="mt-5 space-y-2"><Label for="random-dirs">允许的目录</Label><Input id="random-dirs" v-model="settings.randomImageAPI.allowedDir" placeholder="wallpapers, photos" /></div>
      </Card>
      <Card class="p-5 shadow-none">
        <div class="flex items-start justify-between gap-4"><div class="flex gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><RadioTower class="size-4" /></span><div><h2 class="font-semibold">匿名遥测</h2><p class="mt-1 text-xs leading-5 text-muted-foreground">控制项目的匿名使用统计。关闭不影响核心功能。</p></div></div><Switch v-model="settings.telemetry.enabled" /></div>
      </Card>
      <Card class="p-5 shadow-none">
        <div class="flex items-start justify-between gap-4"><div class="flex gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><ShieldCheck class="size-4" /></span><div><h2 class="font-semibold">WebDAV 服务</h2><p class="mt-1 text-xs leading-5 text-muted-foreground">将 ImgHub 作为 WebDAV 存储使用。</p></div></div><Switch v-model="settings.webDAV.enabled" /></div>
        <div v-if="settings.webDAV.enabled" class="mt-5 grid gap-4 sm:grid-cols-2">
          <div class="space-y-2"><Label for="dav-user">用户名</Label><Input id="dav-user" v-model="settings.webDAV.username" autocomplete="username" /></div>
          <div class="space-y-2"><Label for="dav-pass">密码</Label><Input id="dav-pass" v-model="settings.webDAV.password" type="password" autocomplete="new-password" /></div>
          <div class="space-y-2"><Label for="dav-channel">上传渠道</Label><Input id="dav-channel" v-model="settings.webDAV.uploadChannel" placeholder="cfr2" /></div>
          <div class="space-y-2"><Label for="dav-channel-name">渠道名称</Label><Input id="dav-channel-name" v-model="settings.webDAV.channelName" placeholder="R2_env" /></div>
        </div>
      </Card>
    </div>
  </AppShell>
</template>
