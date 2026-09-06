<script setup lang="ts">
import { computed } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ImageConfigField from './ImageConfigField.vue'
import type { ConfigField } from '@/types/api'

const props = defineProps<{ field: ConfigField; modelValue: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()
const value = computed({
  get: () => props.modelValue,
  set: (next) => emit('update:modelValue', next),
})
</script>

<template>
  <ImageConfigField v-if="field.id === 'siteIcon' || field.id === 'logoUrl'" :field="field" :model-value="value" @update:model-value="value = $event" />
  <div v-else class="grid gap-2">
    <div class="flex items-center justify-between gap-4">
      <div>
        <Label :for="field.id">{{ field.label }}</Label>
        <p v-if="field.tooltip" class="mt-1 max-w-xl text-xs leading-5 text-muted-foreground" v-html="field.tooltip" />
      </div>
      <Switch v-if="field.type === 'boolean'" :model-value="Boolean(value)" @update:model-value="value = $event" />
    </div>
    <Textarea v-if="field.type === 'textarea'" :id="field.id" :model-value="String(value ?? '')" :placeholder="field.placeholder" @update:model-value="value = $event" />
    <Select v-else-if="field.type === 'select'" :model-value="String(value ?? '')" @update:model-value="value = $event">
      <SelectTrigger :id="field.id"><SelectValue :placeholder="field.placeholder || '请选择'" /></SelectTrigger>
      <SelectContent>
        <SelectItem v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
      </SelectContent>
    </Select>
    <Input v-else-if="field.type !== 'boolean'" :id="field.id" :model-value="String(value ?? '')" :type="field.type === 'number' ? 'number' : 'text'" :placeholder="field.placeholder" @update:model-value="value = $event" />
  </div>
</template>
