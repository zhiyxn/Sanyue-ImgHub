<script setup lang="ts">
import { computed } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { ConfigField } from '@/types/api'

const props = defineProps<{ field: ConfigField; modelValue: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()
const value = computed({
  get: () => props.modelValue,
  set: (next) => emit('update:modelValue', next),
})
</script>

<template>
  <div class="grid gap-2">
    <div class="flex items-center justify-between gap-4">
      <div>
        <Label :for="field.id">{{ field.label }}</Label>
        <p v-if="field.tooltip" class="mt-1 max-w-xl text-xs leading-5 text-muted-foreground" v-html="field.tooltip" />
      </div>
      <Switch v-if="field.type === 'boolean'" :model-value="Boolean(value)" @update:model-value="value = $event" />
    </div>
    <Textarea v-if="field.type === 'textarea'" :id="field.id" :model-value="String(value ?? '')" :placeholder="field.placeholder" @update:model-value="value = $event" />
    <select v-else-if="field.type === 'select'" :id="field.id" :value="String(value ?? '')" class="focus-ring h-10 rounded-lg border bg-background px-3 text-sm" @change="value = ($event.target as HTMLSelectElement).value">
      <option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
    <Input v-else-if="field.type !== 'boolean'" :id="field.id" :model-value="String(value ?? '')" :type="field.type === 'number' ? 'number' : 'text'" :placeholder="field.placeholder" @update:model-value="value = $event" />
  </div>
</template>
