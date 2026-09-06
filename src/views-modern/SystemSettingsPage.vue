<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
import type { ChannelMap, ConfigField, PageSettings, SecuritySettings, UploadChannelType } from '@/types/api'
import { useAppStore } from '@/stores/app'

type Tab = 'page' | 'security' | 'storage'
const tab = ref<Tab>('page')
const loading = ref(true)
const saving = ref(false)
const page = ref<PageSettings>({ config: [] })
const availableChannels = ref<ChannelMap>({})
const channelsLoaded = ref(false)
const refreshAnnouncement = ref(false)
const security = ref<SecuritySettings>()
const userPasswordConfirm = ref('')
const adminPasswordConfirm = ref('')
const store = useAppStore()
const { t } = useI18n()

const tabs = computed(() => [
  { id: 'page' as const, label: t('modern.settings.pageTab'), icon: Globe2 },
  { id: 'security' as const, label: t('modern.settings.securityTab'), icon: KeyRound },
  { id: 'storage' as const, label: t('modern.settings.storageTab'), icon: Database },
])

const pageCategories = computed(() => {
  const grouped = new Map<string, ConfigField[]>()
  for (const field of page.value.config) {
    const category = store.locale === 'en' ? field.category_en || field.category || t('modern.settings.otherCategory') : field.category || t('modern.settings.otherCategory')
    grouped.set(category, [...(grouped.get(category) || []), field])
  }
  return [...grouped.entries()]
})

const currentUploadChannel = computed(() => String(page.value.config.find((field) => field.id === 'defaultUploadChannel')?.value || '') as UploadChannelType)
const currentChannelOptions = computed(() => (availableChannels.value[currentUploadChannel.value] || []).map((channel) => ({ label: channel.name, value: channel.name })))

watch(currentUploadChannel, () => {
  if (!channelsLoaded.value) return
  const field = page.value.config.find((item) => item.id === 'defaultChannelName')
  if (field?.value && !currentChannelOptions.value.some((option) => option.value === field.value)) field.value = ''
})

onMounted(async () => {
  const results = await Promise.allSettled([
    api.getPageSettings(),
    api.getSecuritySettings(),
    api.channels(),
  ])
  if (results[0].status === 'fulfilled') {
    page.value = results[0].value
    page.value.config.forEach((field) => {
      if ((field.value === undefined || field.value === null || field.value === '') && field.default !== undefined) field.value = field.default
      if (field.type === 'boolean' && typeof field.value === 'string') field.value = field.value === 'true'
    })
  }
  if (results[1].status === 'fulfilled') security.value = results[1].value
  if (results[2].status === 'fulfilled') availableChannels.value = results[2].value
  channelsLoaded.value = true
  const rejected = results.find((item) => item.status === 'rejected')
  if (rejected?.status === 'rejected') toast.error(rejected.reason instanceof Error ? rejected.reason.message : t('modern.settings.partialLoadFailed'))
  loading.value = false
})

async function save() {
  if (tab.value === 'security' && security.value) {
    const userPassword = security.value.auth.user.authCode
    const adminPassword = security.value.auth.admin.adminPassword
    if (!security.value.auth.user._clear && userPassword && userPassword !== userPasswordConfirm.value) return toast.error(t('modern.settings.userMismatch'))
    if (!security.value.auth.admin._clear && adminPassword && adminPassword !== adminPasswordConfirm.value) return toast.error(t('modern.settings.adminMismatch'))
    if (userPassword && ['%', '&', '?', '#', '/'].some((char) => userPassword.includes(char))) return toast.error(t('modern.settings.reservedChars'))
    const ipQuery = security.value.upload.ipQuery
    if (ipQuery.enabled && !ipQuery.customApi.url.trim()) return toast.error(t('modern.settings.ipUrlRequired'))
  }
  saving.value = true
  try {
    if (tab.value === 'page') {
      page.value = await api.savePageSettings({ ...page.value, refreshAnnouncement: refreshAnnouncement.value })
      refreshAnnouncement.value = false
      await store.bootstrap()
    }
    if (tab.value === 'security' && security.value) {
      await api.saveSecuritySettings(security.value)
      userPasswordConfirm.value = ''
      adminPasswordConfirm.value = ''
    }
    toast.success(t('modern.settings.saved'))
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('modern.settings.saveFailed'))
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
  <AdminShell :title="t('modern.settings.title')" :description="t('modern.settings.shellDescription')">
    <div class="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <PageHeading eyebrow="Configuration" :title="t('modern.settings.title')" :description="t('modern.settings.description')" />
      <Button v-if="tab !== 'storage'" :disabled="saving || loading" @click="save"><LoaderCircle v-if="saving" class="animate-spin" /><Save v-else />{{ t(saving ? 'modern.settings.saving' : 'modern.settings.save') }}</Button>
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
          <template v-for="field in fields" :key="field.id">
            <ConfigFieldInput :field="field" v-model="field.value" :channel-options="field.type === 'channelName' ? currentChannelOptions : undefined" />
            <label v-if="field.id === 'announcement'" class="flex items-start gap-2 rounded-lg border bg-muted/25 p-3 text-sm"><Checkbox v-model="refreshAnnouncement" class="mt-0.5" /><span><span class="font-medium">{{ t('modern.settings.refreshAnnouncement') }}</span><span class="mt-0.5 block text-xs text-muted-foreground">{{ t('modern.settings.refreshAnnouncementHint') }}</span></span></label>
          </template>
        </div>
      </Card>
    </div>

    <div v-else-if="tab === 'security' && security" class="w-full space-y-5">
      <Card class="p-5 shadow-none">
        <h2 class="font-semibold">{{ t('modern.settings.userAuth') }}</h2>
        <p class="mt-1 text-xs text-muted-foreground">{{ t('modern.settings.userAuthHint') }}</p>
        <div class="mt-5 grid gap-4 sm:grid-cols-2"><div class="space-y-2"><Label for="user-password">{{ t('modern.settings.accessPassword') }}</Label><Input id="user-password" v-model="security.auth.user.authCode" type="password" :disabled="security.auth.user._clear" :placeholder="t(security.auth.user._hasPassword ? 'modern.settings.passwordSet' : 'modern.settings.passwordUnset')" autocomplete="new-password" /></div><div class="space-y-2"><Label for="user-password-confirm">{{ t('modern.settings.confirmPassword') }}</Label><Input id="user-password-confirm" v-model="userPasswordConfirm" type="password" :disabled="security.auth.user._clear || !security.auth.user.authCode" :placeholder="t('modern.settings.passwordAgain')" autocomplete="new-password" /></div></div>
        <label class="mt-4 flex items-center gap-2 text-sm"><Checkbox v-model="security.auth.user._clear" />{{ t('modern.settings.clearUserPassword') }}</label>
      </Card>
      <Card class="p-5 shadow-none">
        <h2 class="font-semibold">{{ t('modern.settings.adminAuth') }}</h2>
        <p class="mt-1 text-xs text-muted-foreground">{{ t('modern.settings.adminAuthHint') }}</p>
        <div class="mt-5 space-y-4">
          <div class="space-y-2"><Label for="admin-user">{{ t('modern.settings.adminUsername') }}</Label><Input id="admin-user" v-model="security.auth.admin.adminUsername" :disabled="security.auth.admin._clear" autocomplete="username" /></div>
          <div class="grid gap-4 sm:grid-cols-2"><div class="space-y-2"><Label for="admin-password">{{ t('modern.settings.newPassword') }}</Label><Input id="admin-password" v-model="security.auth.admin.adminPassword" type="password" :disabled="security.auth.admin._clear" :placeholder="t(security.auth.admin._hasPassword ? 'modern.settings.passwordSet' : 'modern.settings.passwordUnset')" autocomplete="new-password" /></div><div class="space-y-2"><Label for="admin-password-confirm">{{ t('modern.settings.confirmPassword') }}</Label><Input id="admin-password-confirm" v-model="adminPasswordConfirm" type="password" :disabled="security.auth.admin._clear || !security.auth.admin.adminPassword" :placeholder="t('modern.settings.passwordAgain')" autocomplete="new-password" /></div></div>
          <label class="flex items-center gap-2 text-sm"><Checkbox v-model="security.auth.admin._clear" />{{ t('modern.settings.clearAdmin') }}</label>
        </div>
      </Card>
      <ApiTokensPanel />
      <Card class="p-5 shadow-none">
        <div class="flex gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><ShieldAlert class="size-4" /></span><div><h2 class="font-semibold">{{ t('modern.settings.moderationTitle') }}</h2><p class="mt-1 text-xs text-muted-foreground">{{ t('modern.settings.moderationHint') }}</p></div></div>
        <div class="mt-5 space-y-5">
          <div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">{{ t('modern.settings.enableModeration') }}</p><p class="text-xs text-muted-foreground">{{ t('modern.settings.newImagesOnly') }}</p></div><Switch v-model="security.upload.moderate.enabled" /></div>
          <template v-if="security.upload.moderate.enabled">
            <div class="space-y-2"><Label for="moderation-provider">{{ t('modern.settings.moderationProvider') }}</Label><Select v-model="security.upload.moderate.channel"><SelectTrigger id="moderation-provider"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="moderatecontent.com">moderatecontent.com</SelectItem><SelectItem value="nsfwjs">{{ t('modern.settings.nsfwApi') }}</SelectItem></SelectContent></Select></div>
            <div v-if="security.upload.moderate.channel === 'moderatecontent.com'" class="space-y-2"><Label for="moderation-key">API Key</Label><Input id="moderation-key" v-model="security.upload.moderate.moderateContentApiKey" type="password" /></div>
            <div v-else class="space-y-2"><Label for="nsfw-path">{{ t('modern.settings.nsfwUrl') }}</Label><Input id="nsfw-path" v-model="security.upload.moderate.nsfwApiPath" placeholder="https://nsfw.example.com" /></div>
          </template>
        </div>
      </Card>
      <Card class="p-5 shadow-none">
        <div class="flex gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><MapPinned class="size-4" /></span><div><h2 class="font-semibold">{{ t('modern.settings.ipQueryTitle') }}</h2><p class="mt-1 text-xs text-muted-foreground">{{ t('modern.settings.ipQueryHint', { ip: '{ip}' }) }}</p></div></div>
        <div class="mt-5 space-y-5">
          <div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">{{ t('modern.settings.enableIpQuery') }}</p><p class="text-xs text-muted-foreground">{{ t('modern.settings.ipFailureHint') }}</p></div><Switch v-model="security.upload.ipQuery.enabled" /></div>
          <template v-if="security.upload.ipQuery.enabled">
            <div class="space-y-2"><Label for="ip-api-url">{{ t('modern.settings.apiUrl') }}</Label><Input id="ip-api-url" v-model="security.upload.ipQuery.customApi.url" placeholder="https://api.example.com/ip" /></div>
            <div class="space-y-2"><div class="flex items-center justify-between"><Label>{{ t('modern.settings.queryParams') }}</Label><Button variant="outline" size="sm" @click="addIpQueryParam"><Plus />{{ t('modern.settings.addParam') }}</Button></div><div class="space-y-2"><div v-for="(param, index) in security.upload.ipQuery.customApi.params" :key="index" class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_36px] gap-2"><Input v-model="param.key" :placeholder="t('modern.settings.paramName')" /><Input v-model="param.value" :placeholder="t('modern.settings.paramValue', { ip: '{ip}' })" /><Button variant="ghost" size="icon" class="text-destructive hover:text-destructive" :disabled="security.upload.ipQuery.customApi.params.length <= 1" @click="removeIpQueryParam(index)"><Trash2 /></Button></div></div></div>
            <div class="space-y-2"><div class="flex items-center justify-between"><div><Label>{{ t('modern.settings.responsePriority') }}</Label><p class="mt-1 text-xs text-muted-foreground">{{ t('modern.settings.responseHint') }}</p></div><Button variant="outline" size="sm" @click="addResponseField"><Plus />{{ t('modern.settings.addField') }}</Button></div><div class="space-y-2"><div v-for="(_, index) in security.upload.ipQuery.customApi.responseFields" :key="index" class="flex gap-2"><Input v-model="security.upload.ipQuery.customApi.responseFields[index]" placeholder="data.city" /><Button variant="ghost" size="icon" :disabled="index === 0" @click="moveResponseField(index, -1)"><ArrowUp /></Button><Button variant="ghost" size="icon" :disabled="index === security.upload.ipQuery.customApi.responseFields.length - 1" @click="moveResponseField(index, 1)"><ArrowDown /></Button><Button variant="ghost" size="icon" class="text-destructive hover:text-destructive" @click="removeResponseField(index)"><Trash2 /></Button></div></div></div>
          </template>
        </div>
      </Card>
      <Card class="p-5 shadow-none">
        <h2 class="font-semibold">{{ t('modern.settings.sessionTitle') }}</h2>
        <div class="mt-5 grid gap-5 sm:grid-cols-2">
          <div class="space-y-2"><Label for="domains">{{ t('modern.settings.allowedDomains') }}</Label><Input id="domains" v-model="security.access.allowedDomains" placeholder="example.com, img.example.com" /></div>
          <div class="space-y-2"><Label for="sizes">{{ t('modern.settings.transformSizes') }}</Label><Input id="sizes" v-model="security.access.imageTransformAllowedSizes" placeholder="320xauto, 640x480" /></div>
          <div class="space-y-2"><Label for="user-age">{{ t('modern.settings.userSessionDays') }}</Label><Input id="user-age" v-model="security.access.userSessionMaxAge" type="number" /></div>
          <div class="space-y-2"><Label for="admin-age">{{ t('modern.settings.adminSessionDays') }}</Label><Input id="admin-age" v-model="security.access.adminSessionMaxAge" type="number" /></div>
          <div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">{{ t('modern.settings.secureCookie') }}</p><p class="text-xs text-muted-foreground">{{ t('modern.settings.secureCookieHint') }}</p></div><Switch v-model="security.access.sessionSecure" /></div>
          <div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">{{ t('modern.settings.whiteListMode') }}</p><p class="text-xs text-muted-foreground">{{ t('modern.settings.whiteListHint') }}</p></div><Switch v-model="security.access.whiteListMode" /></div>
          <div class="flex items-center justify-between rounded-lg border p-3"><div><p class="text-sm font-medium">{{ t('modern.settings.imageTransform') }}</p><p class="text-xs text-muted-foreground">{{ t('modern.settings.imageTransformHint') }}</p></div><Switch v-model="security.access.imageTransformEnabled" /></div>
        </div>
      </Card>
    </div>

    <StorageChannelsPanel v-else-if="tab === 'storage'" />
  </AdminShell>
</template>
