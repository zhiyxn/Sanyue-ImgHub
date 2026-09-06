<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Image as ImageIcon, Link2, LoaderCircle, Upload, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/services/api'
import { useAppStore } from '@/stores/app'
import type { ChannelMap, ConfigField, UploadChannelType } from '@/types/api'

const props = defineProps<{ field: ConfigField; modelValue: unknown; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const store = useAppStore()
const { t } = useI18n()
const fileInput = ref<HTMLInputElement>()
const uploading = ref(false)
const progress = ref(0)
const previewFailed = ref(false)
const label = computed(() => store.locale === 'en' ? props.field.label_en || props.field.label : props.field.label)
const tooltip = computed(() => store.locale === 'en' ? props.field.tooltip_en || props.field.tooltip : props.field.tooltip)

const value = computed({
  get: () => String(props.modelValue || ''),
  set: (next: string) => {
    previewFailed.value = false
    emit('update:modelValue', next)
  },
})

async function resolveUploadChannel() {
  const channels = await api.channels()
  const preferred = store.config.defaultUploadChannel
  const available = (Object.keys(channels) as UploadChannelType[]).filter((key) => channels[key]?.length)
  const channel = preferred && channels[preferred]?.length ? preferred : available[0]
  if (!channel) throw new Error(t('modern.settings.noUploadChannel'))
  const options = (channels as ChannelMap)[channel] || []
  const preferredName = store.config.defaultChannelName
  const channelName = options.find((item) => item.name === preferredName)?.name || options[0]?.name
  return { channel, channelName }
}

async function uploadImage(event: Event) {
  if (props.disabled) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.error(t('modern.settings.chooseImage'))
    return
  }

  uploading.value = true
  progress.value = 0
  try {
    const target = await resolveUploadChannel()
    const result = await api.upload(file, {
      ...target,
      folder: 'site-assets',
      uploadNameType: 'origin',
      returnFormat: 'full',
      onProgress: (next) => { progress.value = next },
    })
    const uploaded = result[0]
    if (!uploaded) throw new Error(t('modern.settings.emptyImageResponse'))
    value.value = uploaded.publicUrl || uploaded.src
    toast.success(t('modern.settings.imageUploaded', { name: label.value }))
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('modern.settings.imageUploadFailed'))
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="grid gap-3">
    <div>
      <Label :for="`${field.id}-url`">{{ label }}</Label>
      <p v-if="tooltip" class="mt-1 max-w-xl text-xs leading-5 text-muted-foreground" v-html="tooltip" />
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div
        class="grid shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40"
        :class="field.id === 'siteIcon' ? 'size-20' : 'h-20 w-36'"
      >
        <img v-if="value && !previewFailed" :src="value" :alt="t('modern.settings.preview', { name: label })" class="size-full object-contain p-2" @error="previewFailed = true" />
        <ImageIcon v-else class="size-6 text-muted-foreground" />
      </div>

      <div class="min-w-0 flex-1 space-y-2">
        <div class="relative">
          <Link2 class="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input :id="`${field.id}-url`" v-model="value" class="pr-10 pl-9" :disabled="disabled" :placeholder="t('modern.settings.pasteImageUrl')" />
          <button v-if="value && !disabled" type="button" class="focus-ring absolute right-2 top-2 grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" :aria-label="t('modern.settings.clearField', { name: label })" @click="value = ''">
            <X class="size-3.5" />
          </button>
        </div>
        <div class="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" :disabled="uploading || disabled" @click="fileInput?.click()">
            <LoaderCircle v-if="uploading" class="animate-spin" /><Upload v-else />
            {{ uploading ? t('modern.settings.uploadingImage', { progress }) : t('modern.settings.uploadImage') }}
          </Button>
          <span class="text-xs text-muted-foreground">{{ t(disabled ? 'modern.settings.fixedHint' : 'modern.settings.urlHint') }}</span>
        </div>
        <input ref="fileInput" type="file" accept="image/*,.ico" class="sr-only" @change="uploadImage" />
      </div>
    </div>
  </div>
</template>
