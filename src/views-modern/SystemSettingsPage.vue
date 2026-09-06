<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowDown, ArrowUp, Database, Globe2, KeyRound, LoaderCircle, MapPinned, Plus, Save, ServerCog, ShieldAlert, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import AdminShell from '@/components/modern/AdminShell.vue'
import PageHeading from '@/components/modern/PageHeading.vue'
import ConfigFieldInput from '@/components/modern/ConfigFieldInput.vue'
import ApiTokensPanel from '@/components/modern/ApiTokensPanel.vue'
import StorageChannelsPanel from '@/components/modern/StorageChannelsPanel.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/services/api'
import type { ConfigField, PageSettings, SecuritySettings } from '@/types/api'
import { useAppStore } from '@/stores/app'

type Tab = 'page' | 'security' | 'storage'
const tab = ref<Tab>('page')
const loading = ref(true)
const saving = ref(false)
const page = ref<PageSettings>({ config: [] })
const security = ref<SecuritySettings>()
const userPasswordConfirm = ref('')
const adminPasswordConfirm = ref('')
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

onMounted(async () => {
  const results = await Promise.allSettled([
    api.getPageSettings(),
    api.getSecuritySettings(),
  ])
  if (results[0].status === 'fulfilled') page.value = results[0].value
  if (results[1].status === 'fulfilled') security.value = results[1].value
  const rejected = results.find((item) => item.status === 'rejected')
  if (rejected?.status === 'rejected') toast.error(rejected.reason instanceof Error ? rejected.reason.message : '部分配置加载失败')
  loading.value = false
})

async function save() {
  if (tab.value === 'security' && security.value) {
    const userPassword = security.value.auth.user.authCode
    const adminPassword = security.value.auth.admin.adminPassword
    if (!security.value.auth.user._clear && userPassword && userPassword !== userPasswordConfirm.value) return toast.error('普通用户密码两次输入不一致')
    if (!security.value.auth.admin._clear && adminPassword && adminPassword !== adminPasswordConfirm.value) return toast.error('管理员密码两次输入不一致')
    if (userPassword && ['%', '&', '?', '#', '/'].some((char) => userPassword.includes(char))) return toast.error('普通用户密码不能包含 URL 保留字符 % & ? # /')
    const ipQuery = security.value.upload.ipQuery
    if (ipQuery.enabled && !ipQuery.customApi.url.trim()) return toast.error('启用 IP 查询时必须填写接口地址')
  }
  saving.value = true
  try {
    if (tab.value === 'page') {
      page.value = await api.savePageSettings(page.value)
      await store.bootstrap()
    }
    if (tab.value === 'security' && security.value) {
      await api.saveSecuritySettings(security.value)
      userPasswordConfirm.value = ''
      adminPasswordConfirm.value = ''
    }
    toast.success('设置已保存')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function addIpQueryParam() {
  security.value?.upload.ipQuery.customApi.params.push({ key: '', value: '' })
}

function removeIpQueryParam(index: number) {
  const params = security.value?.upload.ipQuery.customApi.params
  if (params && params.length > 1) params.splice(index, 1)
}

function addResponseField() {
  security.value?.upload.ipQuery.customApi.responseFields.push('')
}

function removeResponseField(index: number) {
  security.value?.upload.ipQuery.customApi.responseFields.splice(index, 1)
}

function moveResponseField(index: number, direction: -1 | 1) {
  const fields = security.value?.upload.ipQuery.customApi.responseFields
  if (!fields) return
  const target = index + direction
  if (target < 0 || target >= fields.length) return
  const [field] = fields.splice(index, 1)
  if (field !== undefined) fields.splice(target, 0, field)
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

    <div v-if="loading" class="w-full space-y-4"><Skeleton v-for="index in 4" :key="index" class="h-64 rounded-xl" /></div>

    <div v-else-if="tab === 'page'" class="w-full space-y-5">
      <Card v-for="[category, fields] in pageCategories" :key="category" class="p-5 shadow-none">
        <div class="mb-5 flex items-center gap-3"><span class="grid size-9 place-items-center rounded-lg bg-muted"><ServerCog class="size-4" /></span><h2 class="font-semibold">{{ category }}</h2></div>
        <div class="space-y-5">
          <ConfigFieldInput v-for="field in fields" :key="field.id" :field="field" v-model="field.value" />
        </div>
      </Card>
    </div>

    <div v-else-if="tab === 'security' && security" class="w-full space-y-5">
      <Card class="p-5 shadow-none">
        <h2 class="font-semibold">普通用户认证</h2>
        <p class="mt-1 text-xs text-muted-foreground">保护上传页和需要用户权限的接口。</p>
        <div class="mt-5 grid gap-4 sm:grid-cols-2"><div class="space-y-2"><Label for="user-password">访问密码</Label><Input id="user-password" v-model="security.auth.user.authCode" type="password" :disabled="security.auth.user._clear" :placeholder="security.auth.user._hasPassword ? '已设置，留空保持不变' : '未设置'" autocomplete="new-password" /></div><div class="space-y-2"><Label for="user-password-confirm">确认新密码</Label><Input id="user-password-confirm" v-model="userPasswordConfirm" type="password" :disabled="security.auth.user._clear || !security.auth.user.authCode" placeholder="再次输入新密码" autocomplete="new-password" /></div></div>
        <label class="mt-4 flex items-center gap-2 text-sm"><Checkbox v-model="security.auth.user._clear" />清除现有普通用户密码</label>
      </Card>
      <Card class="p-5 shadow-none">
        <h2 class="font-semibold">管理员认证</h2>
        <p class="mt-1 text-xs text-muted-foreground">用于文件管理和系统配置。</p>
        <div class="mt-5 space-y-4">
          <div class="space-y-2"><Label for="admin-user">管理员用户名</Label><Input id="admin-user" v-model="security.auth.admin.adminUsername" :disabled="security.auth.admin._clear" autocomplete="username" /></div>
          <div class="grid gap-4 sm:grid-cols-2"><div class="space-y-2"><Label for="admin-password">新密码</Label><Input id="admin-password" v-model="security.auth.admin.adminPassword" type="password" :disabled="security.auth.admin._clear" :placeholder="security.auth.admin._hasPassword ? '已设置，留空保持不变' : '未设置'" autocomplete="new-password" /></div><div class="space-y-2"><Label for="admin-password-confirm">确认新密码</Label><Input id="admin-password-confirm" v-model="adminPasswordConfirm" type="password" :disabled="security.auth.admin._clear || !security.auth.admin.adminPassword" placeholder="再次输入新密码" autocomplete="new-password" /></div></div>
          <label class="flex items-center gap-2 text-sm"><Checkbox v-model="security.auth.admin._clear" />清除管理员账号和密码</label>
        </div>
      </Card>
      <ApiTokensPanel />
      <Card class="p-5 shadow-none">
        <div class="flex gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><ShieldAlert class="size-4" /></span><div><h2 class="font-semibold">上传内容审核</h2><p class="mt-1 text-xs text-muted-foreground">上传前调用内容审核服务，阻止不适合公开展示的图片。</p></div></div>
        <div class="mt-5 space-y-5">
          <div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">启用图片审核</p><p class="text-xs text-muted-foreground">仅影响新上传的图片</p></div><Switch v-model="security.upload.moderate.enabled" /></div>
          <template v-if="security.upload.moderate.enabled">
            <div class="space-y-2"><Label for="moderation-provider">审核服务</Label><Select v-model="security.upload.moderate.channel"><SelectTrigger id="moderation-provider"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="moderatecontent.com">moderatecontent.com</SelectItem><SelectItem value="nsfwjs">NSFWJS 自建接口</SelectItem></SelectContent></Select></div>
            <div v-if="security.upload.moderate.channel === 'moderatecontent.com'" class="space-y-2"><Label for="moderation-key">API Key</Label><Input id="moderation-key" v-model="security.upload.moderate.moderateContentApiKey" type="password" /></div>
            <div v-else class="space-y-2"><Label for="nsfw-path">NSFWJS 接口地址</Label><Input id="nsfw-path" v-model="security.upload.moderate.nsfwApiPath" placeholder="https://nsfw.example.com" /></div>
          </template>
        </div>
      </Card>
      <Card class="p-5 shadow-none">
        <div class="flex gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><MapPinned class="size-4" /></span><div><h2 class="font-semibold">IP 归属地查询</h2><p class="mt-1 text-xs text-muted-foreground">使用自定义接口记录上传来源的地理信息，{ip} 会替换为访客地址。</p></div></div>
        <div class="mt-5 space-y-5">
          <div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">启用 IP 查询</p><p class="text-xs text-muted-foreground">查询失败不会阻止上传</p></div><Switch v-model="security.upload.ipQuery.enabled" /></div>
          <template v-if="security.upload.ipQuery.enabled">
            <div class="space-y-2"><Label for="ip-api-url">接口地址</Label><Input id="ip-api-url" v-model="security.upload.ipQuery.customApi.url" placeholder="https://api.example.com/ip" /></div>
            <div class="space-y-2"><div class="flex items-center justify-between"><Label>请求参数</Label><Button variant="outline" size="sm" @click="addIpQueryParam"><Plus />添加参数</Button></div><div class="space-y-2"><div v-for="(param, index) in security.upload.ipQuery.customApi.params" :key="index" class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_36px] gap-2"><Input v-model="param.key" placeholder="参数名，例如 ip" /><Input v-model="param.value" placeholder="参数值，例如 {ip}" /><Button variant="ghost" size="icon" class="text-destructive hover:text-destructive" :disabled="security.upload.ipQuery.customApi.params.length <= 1" @click="removeIpQueryParam(index)"><Trash2 /></Button></div></div></div>
            <div class="space-y-2"><div class="flex items-center justify-between"><div><Label>响应字段优先级</Label><p class="mt-1 text-xs text-muted-foreground">按顺序读取 JSON 字段路径，例如 data.city。</p></div><Button variant="outline" size="sm" @click="addResponseField"><Plus />添加字段</Button></div><div class="space-y-2"><div v-for="(_, index) in security.upload.ipQuery.customApi.responseFields" :key="index" class="flex gap-2"><Input v-model="security.upload.ipQuery.customApi.responseFields[index]" placeholder="data.city" /><Button variant="ghost" size="icon" :disabled="index === 0" @click="moveResponseField(index, -1)"><ArrowUp /></Button><Button variant="ghost" size="icon" :disabled="index === security.upload.ipQuery.customApi.responseFields.length - 1" @click="moveResponseField(index, 1)"><ArrowDown /></Button><Button variant="ghost" size="icon" class="text-destructive hover:text-destructive" @click="removeResponseField(index)"><Trash2 /></Button></div></div></div>
          </template>
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
          <div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">文件白名单模式</p><p class="text-xs text-muted-foreground">开启后仅白名单文件可公开访问</p></div><Switch v-model="security.access.whiteListMode" /></div>
          <div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">图片尺寸变换</p><p class="text-xs text-muted-foreground">允许通过参数动态缩放</p></div><Switch v-model="security.access.imageTransformEnabled" /></div>
        </div>
      </Card>
    </div>

    <StorageChannelsPanel v-else-if="tab === 'storage'" />
  </AdminShell>
</template>
