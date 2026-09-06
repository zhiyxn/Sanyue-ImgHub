<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { LoaderCircle, Tags } from '@lucide/vue'
import { Input } from '@/components/ui/input'
import { api } from '@/services/api'

const props = defineProps<{ modelValue: string; placeholder?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const suggestions = ref<string[]>([])
const open = ref(false)
const loading = ref(false)
let timer: number | undefined
let blurTimer: number | undefined

const value = computed({
  get: () => props.modelValue,
  set: (next: string) => emit('update:modelValue', next),
})
const prefix = computed(() => value.value.split(',').pop()?.trim() || '')

async function loadSuggestions() {
  if (props.disabled) return
  loading.value = true
  try {
    const existing = new Set(value.value.split(',').slice(0, -1).map((item) => item.trim().toLowerCase()).filter(Boolean))
    suggestions.value = (await api.tagSuggestions(prefix.value))
      .filter((item) => !existing.has(item.toLowerCase()))
      .slice(0, 10)
    open.value = suggestions.value.length > 0
  } catch {
    suggestions.value = []
    open.value = false
  } finally {
    loading.value = false
  }
}

function choose(tag: string) {
  const current = value.value.split(',')
  if (current.length) current[current.length - 1] = ` ${tag}`
  else current.push(tag)
  value.value = `${current.map((item) => item.trim()).filter(Boolean).join(', ')}, `
  open.value = false
}

function handleFocus() {
  window.clearTimeout(blurTimer)
  void loadSuggestions()
}

function handleBlur() {
  blurTimer = window.setTimeout(() => { open.value = false }, 140)
}

watch(() => props.modelValue, () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(loadSuggestions, 280)
})

onBeforeUnmount(() => {
  window.clearTimeout(timer)
  window.clearTimeout(blurTimer)
})
</script>

<template>
  <div class="relative">
    <Input v-model="value" :placeholder="placeholder" :disabled="disabled" autocomplete="off" @focus="handleFocus" @blur="handleBlur" />
    <LoaderCircle v-if="loading" class="pointer-events-none absolute right-3 top-3 size-4 animate-spin text-muted-foreground" />
    <div v-if="open" class="absolute inset-x-0 top-[calc(100%+6px)] z-40 max-h-52 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
      <button v-for="tag in suggestions" :key="tag" type="button" class="focus-ring flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent" @mousedown.prevent="choose(tag)">
        <Tags class="size-3.5 text-muted-foreground" />{{ tag }}
      </button>
    </div>
  </div>
</template>
