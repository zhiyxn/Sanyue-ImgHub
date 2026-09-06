<script setup lang="ts">
import { computed } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ImageConfigField from './ImageConfigField.vue'
import type { ConfigField, ConfigOption } from '@/types/api'

const props = defineProps<{ field: ConfigField; modelValue: unknown; channelOptions?: ConfigOption[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()
const value = computed({
  get: () => props.modelValue,
  set: (next) => emit('update:modelValue', next),
})
</script>

<template>
  <ImageConfigField v-if="field.id === 'siteIcon' || field.id === 'logoUrl'" :field="field" :model-value="value" :disabled="field.fixed" @update:model-value="value = $event" />
  <div v-else class="grid gap-2">
    <div class="flex items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2"><Label :for="field.id">{{ field.label }}</Label><span v-if="field.fixed" class="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">环境变量</span></div>
        <p v-if="field.tooltip" class="mt-1 max-w-xl text-xs leading-5 text-muted-foreground" v-html="field.tooltip" />
      </div>
      <Switch v-if="field.type === 'boolean'" :model-value="Boolean(value)" :disabled="field.fixed" @update:model-value="value = $event" />
    </div>
    <Textarea v-if="field.type === 'textarea'" :id="field.id" :model-value="String(value ?? '')" :disabled="field.fixed" :placeholder="field.placeholder" @update:model-value="value = $event" />
    <Select v-else-if="field.type === 'select'" :model-value="String(value ?? '')" :disabled="field.fixed" @update:model-value="value = $event">
      <SelectTrigger :id="field.id"><SelectValue :placeholder="field.placeholder || '请选择'" /></SelectTrigger>
      <SelectContent>
        <SelectItem v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
      </SelectContent>
    </Select>
    <Select v-else-if="field.type === 'channelName'" :model-value="String(value ?? '')" :disabled="field.fixed || !channelOptions?.length" @update:model-value="value = $event">
      <SelectTrigger :id="field.id"><SelectValue :placeholder="channelOptions?.length ? '选择默认渠道名称' : '请先选择可用的渠道类型'" /></SelectTrigger>
      <SelectContent><SelectItem v-for="option in channelOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem></SelectContent>
    </Select>
    <Input v-else-if="field.type !== 'boolean'" :id="field.id" :model-value="String(value ?? '')" :disabled="field.fixed" :type="field.type === 'number' ? 'number' : 'text'" :placeholder="field.placeholder" @update:model-value="value = $event" />
  </div>
</template>
