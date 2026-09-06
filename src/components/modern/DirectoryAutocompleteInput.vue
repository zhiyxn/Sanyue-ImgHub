<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Folder, LoaderCircle } from '@lucide/vue'
import { Input } from '@/components/ui/input'
import { api } from '@/services/api'

interface DirectoryNode { path?: string; name?: string; children?: DirectoryNode[] }

const props = defineProps<{ modelValue: string; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()
const paths = ref<string[]>([])
const loading = ref(false)
const loaded = ref(false)
const focused = ref(false)

const value = computed({ get: () => props.modelValue, set: (next) => emit('update:modelValue', next) })
const suggestions = computed(() => {
  const query = normalize(props.modelValue).toLocaleLowerCase()
  return paths.value.filter((path) => !query || path.toLocaleLowerCase().startsWith(query)).slice(0, 10)
})

function normalize(input: string) {
  return input.replace(/^\/+|\/+$/g, '')
}

function collect(node: DirectoryNode, result: Set<string>) {
  const path = normalize(String(node.path || ''))
  if (path) result.add(path)
  for (const child of node.children || []) collect(child, result)
}

async function load() {
  if (loaded.value || loading.value) return
  loading.value = true
  try {
    const response = await api.directories()
    const result = new Set<string>()
    for (const path of response.directories || []) if (normalize(path)) result.add(normalize(path))
    if (response.tree && typeof response.tree === 'object') collect(response.tree as DirectoryNode, result)
    paths.value = [...result].sort((a, b) => a.localeCompare(b))
    loaded.value = true
  } finally { loading.value = false }
}

function select(path: string) {
  value.value = path
  focused.value = false
}

function blur() {
  window.setTimeout(() => { focused.value = false }, 120)
}
</script>

<template>
  <div class="relative">
    <Folder class="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
    <Input v-model="value" class="pl-9" :placeholder="placeholder" autocomplete="off" @focus="focused = true; load()" @blur="blur" />
    <div v-if="focused && (loading || suggestions.length)" class="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
      <div v-if="loading" class="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><LoaderCircle class="size-3.5 animate-spin" />{{ t('modern.directory.loading') }}</div>
      <button v-for="path in suggestions" v-else :key="path" type="button" class="focus-ring block w-full truncate rounded-md px-3 py-2 text-left text-sm hover:bg-muted" @mousedown.prevent="select(path)">{{ path }}</button>
    </div>
  </div>
</template>
