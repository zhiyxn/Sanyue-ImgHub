<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ImageConfigField from './ImageConfigField.vue'
import type { ConfigField, ConfigOption } from '@/types/api'
import { useAppStore } from '@/stores/app'

const props = defineProps<{ field: ConfigField; modelValue: unknown; channelOptions?: ConfigOption[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()
const store = useAppStore()
const { t } = useI18n()
const value = computed({
  get: () => props.modelValue,
  set: (next) => emit('update:modelValue', next),
})
const label = computed(() => store.locale === 'en' ? props.field.label_en || props.field.label : props.field.label)
const tooltip = computed(() => store.locale === 'en' ? props.field.tooltip_en || props.field.tooltip : props.field.tooltip)
const placeholder = computed(() => store.locale === 'en' ? props.field.placeholder_en || props.field.placeholder : props.field.placeholder)
const options = computed(() => (props.field.options || []).map((option) => ({ ...option, label: store.locale === 'en' ? option.label_en || option.label : option.label })))
</script>

<template>
  <ImageConfigField v-if="field.id === 'siteIcon' || field.id === 'logoUrl'" :field="field" :model-value="value" :disabled="field.fixed" @update:model-value="value = $event" />
  <div v-else class="grid gap-2">
    <div class="flex items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2"><Label :for="field.id">{{ label }}</Label><span v-if="field.fixed" class="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">{{ t('modern.access.environment') }}</span></div>
        <p v-if="tooltip" class="mt-1 max-w-xl text-xs leading-5 text-muted-foreground" v-html="tooltip" />
      </div>
      <Switch v-if="field.type === 'boolean'" :model-value="Boolean(value)" :disabled="field.fixed" @update:model-value="value = $event" />
    </div>
    <Textarea v-if="field.type === 'textarea'" :id="field.id" :model-value="String(value ?? '')" :disabled="field.fixed" :placeholder="placeholder" @update:model-value="value = $event" />
    <Select v-else-if="field.type === 'select'" :model-value="String(value ?? '')" :disabled="field.fixed" @update:model-value="value = $event">
      <SelectTrigger :id="field.id"><SelectValue :placeholder="placeholder || t('common.select')" /></SelectTrigger>
      <SelectContent>
        <SelectItem v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
      </SelectContent>
    </Select>
    <Select v-else-if="field.type === 'channelName'" :model-value="String(value ?? '')" :disabled="field.fixed || !channelOptions?.length" @update:model-value="value = $event">
      <SelectTrigger :id="field.id"><SelectValue :placeholder="t(channelOptions?.length ? 'modern.settings.chooseDefaultChannel' : 'modern.settings.chooseChannelFirst')" /></SelectTrigger>
      <SelectContent><SelectItem v-for="option in channelOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem></SelectContent>
    </Select>
    <Input v-else-if="field.type !== 'boolean'" :id="field.id" :model-value="String(value ?? '')" :disabled="field.fixed" :type="field.type === 'number' ? 'number' : 'text'" :placeholder="placeholder" @update:model-value="value = $event" />
  </div>
</template>
