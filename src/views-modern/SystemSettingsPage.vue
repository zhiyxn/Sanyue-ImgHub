<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Database, Globe2, KeyRound, LoaderCircle, Save, ServerCog } from '@lucide/vue'
import { toast } from 'vue-sonner'
import AdminShell from '@/components/modern/AdminShell.vue'
import PageHeading from '@/components/modern/PageHeading.vue'
import ConfigFieldInput from '@/components/modern/ConfigFieldInput.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/services/api'
import type { ConfigField, PageSettings, SecuritySettings } from '@/types/api'
import { useAppStore } from '@/stores/app'

type Tab = 'page' | 'security' | 'storage'
const tab = ref<Tab>('page')
const loading = ref(true)
const saving = ref(false)
const page = ref<PageSettings>({ config: [] })
const security = ref<SecuritySettings>()
const upload = ref<Record<string, unknown>>({})
const store = useAppStore()

const tabs = [
  { id: 'page' as const, label: '页面', icon: Globe2 },
  { id: 'security' as const, label: '认证与安全', icon: KeyRound },
  { id: 'storage' as const, label: '存储渠道', icon: Database },
]

const pageCategories = computed(() => {
  const grouped = new Map<string, ConfigField[]>()
  for (const field of page.value.config) {
    const category = field.category || '其他'
    grouped.set(category, [...(grouped.get(category) || []), field])
  }
  return [...grouped.entries()]
})

const storageGroups = computed(() =>
  Object.entries(upload.value)
    .map(([key, value]) => {
      const group = value as { channels?: Array<Record<string, unknown>> }
      return { key, channels: Array.isArray(group?.channels) ? group.channels : [] }
    })
    .filter((group) => group.channels.length),
)

onMounted(async () => {
  const results = await Promise.allSettled([
    api.getPageSettings(),
    api.getSecuritySettings(),
    api.getUploadSettings(),
  ])
  if (results[0].status === 'fulfilled') page.value = results[0].value
  if (results[1].status === 'fulfilled') security.value = results[1].value
  if (results[2].status === 'fulfilled') upload.value = results[2].value
  const rejected = results.find((item) => item.status === 'rejected')
  if (rejected?.status === 'rejected') toast.error(rejected.reason instanceof Error ? rejected.reason.message : '部分配置加载失败')
  loading.value = false
})

async function save() {
  saving.value = true
  try {
    if (tab.value === 'page') {
      page.value = await api.savePageSettings(page.value)
      await store.bootstrap()
    }
    if (tab.value === 'security' && security.value) await api.saveSecuritySettings(security.value)
    toast.success('设置已保存')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AdminShell title="系统设置" description="站点外观、认证策略与存储渠道">
    <div class="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <PageHeading eyebrow="Configuration" title="系统设置" description="管理站点外观、登录认证和存储渠道状态。" />
      <Button v-if="tab !== 'storage'" :disabled="saving || loading" @click="save"><LoaderCircle v-if="saving" class="animate-spin" /><Save v-else />{{ saving ? '保存中…' : '保存更改' }}</Button>
    </div>

    <Tabs v-model="tab" class="mb-6">
      <TabsList>
        <TabsTrigger v-for="item in tabs" :key="item.id" :value="item.id">
          <component :is="item.icon" class="size-4" />{{ item.label }}
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <div v-if="loading" class="max-w-5xl space-y-4"><Skeleton v-for="index in 4" :key="index" class="h-64 rounded-xl" /></div>

    <div v-else-if="tab === 'page'" class="max-w-5xl space-y-5">
      <Card v-for="[category, fields] in pageCategories" :key="category" class="p-5 shadow-none">
        <div class="mb-5 flex items-center gap-3"><span class="grid size-9 place-items-center rounded-lg bg-muted"><ServerCog class="size-4" /></span><h2 class="font-semibold">{{ category }}</h2></div>
        <div class="space-y-5">
          <ConfigFieldInput v-for="field in fields" :key="field.id" :field="field" v-model="field.value" />
        </div>
      </Card>
    </div>

    <div v-else-if="tab === 'security' && security" class="max-w-5xl space-y-5">
      <Card class="p-5 shadow-none">
        <h2 class="font-semibold">普通用户认证</h2>
        <p class="mt-1 text-xs text-muted-foreground">保护上传页和需要用户权限的接口。</p>
        <div class="mt-5 space-y-2"><Label for="user-password">访问密码</Label><Input id="user-password" v-model="security.auth.user.authCode" type="password" :placeholder="security.auth.user._hasPassword ? '已设置，留空保持不变' : '未设置'" autocomplete="new-password" /></div>
        <label class="mt-4 flex items-center gap-2 text-sm"><Checkbox v-model="security.auth.user._clear" />清除现有普通用户密码</label>
      </Card>
      <Card class="p-5 shadow-none">
        <h2 class="font-semibold">管理员认证</h2>
        <p class="mt-1 text-xs text-muted-foreground">用于文件管理和系统配置。</p>
        <div class="mt-5 space-y-4">
          <div class="space-y-2"><Label for="admin-user">管理员用户名</Label><Input id="admin-user" v-model="security.auth.admin.adminUsername" autocomplete="username" /></div>
          <div class="space-y-2"><Label for="admin-password">新密码</Label><Input id="admin-password" v-model="security.auth.admin.adminPassword" type="password" :placeholder="security.auth.admin._hasPassword ? '已设置，留空保持不变' : '未设置'" autocomplete="new-password" /></div>
          <label class="flex items-center gap-2 text-sm"><Checkbox v-model="security.auth.admin._clear" />清除管理员账号和密码</label>
        </div>
      </Card>
      <Card class="p-5 shadow-none">
        <h2 class="font-semibold">会话与访问策略</h2>
        <div class="mt-5 grid gap-5 sm:grid-cols-2">
          <div class="space-y-2"><Label for="domains">允许的来源域名</Label><Input id="domains" v-model="security.access.allowedDomains" placeholder="example.com, img.example.com" /></div>
          <div class="space-y-2"><Label for="sizes">允许的图片变换尺寸</Label><Input id="sizes" v-model="security.access.imageTransformAllowedSizes" placeholder="320xauto, 640x480" /></div>
          <div class="space-y-2"><Label for="user-age">用户会话有效期（天）</Label><Input id="user-age" v-model="security.access.userSessionMaxAge" type="number" /></div>
          <div class="space-y-2"><Label for="admin-age">管理员会话有效期（天）</Label><Input id="admin-age" v-model="security.access.adminSessionMaxAge" type="number" /></div>
          <div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">仅安全连接 Cookie</p><p class="text-xs text-muted-foreground">生产 HTTPS 环境建议开启</p></div><Switch v-model="security.access.sessionSecure" /></div>
          <div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">图片尺寸变换</p><p class="text-xs text-muted-foreground">允许通过参数动态缩放</p></div><Switch v-model="security.access.imageTransformEnabled" /></div>
        </div>
      </Card>
    </div>

    <div v-else-if="tab === 'storage'" class="max-w-5xl space-y-4">
      <Card v-for="group in storageGroups" :key="group.key" class="p-5 shadow-none">
        <div class="flex items-center justify-between"><h2 class="font-semibold capitalize">{{ group.key }}</h2><Badge variant="secondary">{{ group.channels.length }} 个渠道</Badge></div>
        <div class="mt-4 space-y-2">
          <div v-for="channel in group.channels" :key="String(channel.name)" class="flex items-center justify-between rounded-lg border p-3">
            <div class="min-w-0"><p class="truncate text-sm font-medium">{{ channel.name }}</p><p class="text-xs text-muted-foreground">{{ channel.savePath === 'environment variable' ? '环境变量' : '系统配置' }}</p></div>
            <Badge :variant="channel.enabled === false ? 'outline' : 'success'">{{ channel.enabled === false ? '停用' : '可用' }}</Badge>
          </div>
        </div>
      </Card>
    </div>
  </AdminShell>
</template>
