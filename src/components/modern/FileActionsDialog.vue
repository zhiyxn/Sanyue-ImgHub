<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { Ban, CheckCircle2, Clipboard, Download, ExternalLink, LoaderCircle, Save, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { api } from '@/services/api'
import TagAutocompleteInput from './TagAutocompleteInput.vue'
import { copyText, formatDate } from '@/lib/utils'
import type { FileRecord } from '@/types/api'

const props = defineProps<{ open: boolean; file?: FileRecord; url?: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; changed: [] }>()
const saving = ref(false)
const fileId = ref('')
const displayName = ref('')
const mimeType = ref('')
const tags = ref('')

watch(() => props.file, (file) => {
  fileId.value = file?.name || ''
  displayName.value = file?.metadata?.FileName || ''
  mimeType.value = file?.metadata?.FileType || ''
  tags.value = file?.metadata?.Tags?.join(', ') || ''
}, { immediate: true })

const folder = computed(() => props.file?.name.split('/').slice(0, -1).join('/') || '根目录')

async function save() {
  if (!props.file || !fileId.value.trim()) return
  saving.value = true
  try {
    const original = props.file.name
    if (displayName.value !== (props.file.metadata?.FileName || '') || mimeType.value !== (props.file.metadata?.FileType || '')) {
      await api.updateMetadata(original, { FileName: displayName.value, FileType: mimeType.value })
    }
    const tagList = [...new Set(tags.value.split(',').map((item) => item.trim()).filter(Boolean))]
    if (tagList.join(',') !== (props.file.metadata?.Tags || []).join(',')) await api.setTags(original, tagList)
    if (fileId.value.trim() !== original) await api.renameFile(original, fileId.value.trim())
    toast.success('文件信息已更新')
    emit('update:open', false)
    emit('changed')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function setListType(type: 'Block' | 'White') {
  if (!props.file) return
  saving.value = true
  try {
    await api.setListType(props.file.name, type)
    toast.success(type === 'Block' ? '已加入黑名单' : '已加入白名单')
    emit('update:open', false)
    emit('changed')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    saving.value = false
  }
}

async function copyFormat(format: 'url' | 'markdown' | 'html' | 'bbcode') {
  if (!props.file || !props.url) return
  const name = props.file.metadata?.FileName || props.file.name.split('/').pop() || props.file.name
  const values = {
    url: props.url,
    markdown: `![${name}](${props.url})`,
    html: `<img src="${props.url}" alt="${name}">`,
    bbcode: `[img]${props.url}[/img]`,
  }
  await copyText(values[format])
  toast.success('链接代码已复制')
}

function downloadFile() {
  if (!props.url || !props.file) return
  const anchor = document.createElement('a')
  anchor.href = props.url
  anchor.download = props.file.metadata?.FileName || props.file.name.split('/').pop() || 'download'
  anchor.click()
}
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
      <DialogContent class="fixed right-0 top-0 z-50 h-full w-full max-w-lg overflow-y-auto border-l bg-background p-6 shadow-2xl sm:p-7">
        <div class="flex items-start justify-between gap-4">
          <div><DialogTitle class="text-xl font-semibold">文件详情</DialogTitle><DialogDescription class="mt-1 text-sm text-muted-foreground">查看元数据并管理文件属性。</DialogDescription></div>
          <DialogClose as-child><Button variant="ghost" size="icon"><X /></Button></DialogClose>
        </div>

        <div v-if="file" class="mt-7 space-y-6">
          <a v-if="url" :href="url" target="_blank" class="group relative block aspect-video overflow-hidden rounded-xl border bg-muted">
            <img v-if="file.metadata?.FileType?.startsWith('image/')" :src="url" alt="" class="size-full object-contain" />
            <span v-else class="absolute inset-0 grid place-items-center text-sm text-muted-foreground">无法在浏览器中预览</span>
            <span class="absolute right-2 top-2 grid size-8 place-items-center rounded-lg bg-background/90 opacity-0 shadow-sm transition group-hover:opacity-100"><ExternalLink class="size-4" /></span>
          </a>

          <div class="grid grid-cols-2 gap-3 rounded-xl border bg-muted/25 p-4 text-xs">
            <div><p class="text-muted-foreground">存储渠道</p><p class="mt-1 font-medium">{{ file.metadata?.Channel || '—' }}</p></div>
            <div><p class="text-muted-foreground">渠道名称</p><p class="mt-1 font-medium">{{ file.metadata?.ChannelName || '—' }}</p></div>
            <div><p class="text-muted-foreground">所在目录</p><p class="mt-1 truncate font-medium">{{ folder }}</p></div>
            <div><p class="text-muted-foreground">上传时间</p><p class="mt-1 font-medium">{{ formatDate(file.metadata?.TimeStamp) }}</p></div>
          </div>

          <div class="rounded-xl border p-4">
            <div class="mb-3 flex items-center justify-between"><div><p class="text-sm font-medium">链接与下载</p><p class="text-xs text-muted-foreground">复制常用发布格式，或下载原文件。</p></div><Button variant="ghost" size="icon" aria-label="下载文件" @click="downloadFile"><Download /></Button></div>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4"><Button variant="outline" size="sm" @click="copyFormat('url')"><Clipboard />原链接</Button><Button variant="outline" size="sm" @click="copyFormat('markdown')">Markdown</Button><Button variant="outline" size="sm" @click="copyFormat('html')">HTML</Button><Button variant="outline" size="sm" @click="copyFormat('bbcode')">BBCode</Button></div>
          </div>

          <div class="space-y-4">
            <div class="space-y-2"><Label for="file-id">文件路径 / ID</Label><Input id="file-id" v-model="fileId" /><p class="text-xs text-muted-foreground">修改完整路径可以同时重命名或移动文件。</p></div>
            <div class="space-y-2"><Label for="display-name">显示名称</Label><Input id="display-name" v-model="displayName" placeholder="可选" /></div>
            <div class="space-y-2"><Label for="mime">MIME 类型</Label><Input id="mime" v-model="mimeType" placeholder="image/jpeg" /></div>
            <div class="space-y-2"><Label for="tags">标签</Label><TagAutocompleteInput v-model="tags" placeholder="旅行, 壁纸, 2026" /><p class="text-xs text-muted-foreground">输入时会显示已有标签建议，使用英文逗号分隔多个标签。</p></div>
          </div>

          <div class="flex flex-wrap gap-2">
            <Badge v-for="tag in file.metadata?.Tags" :key="tag" variant="secondary">{{ tag }}</Badge>
          </div>

          <div class="border-t pt-5">
            <p class="mb-3 text-sm font-medium">访问名单</p>
            <div class="grid grid-cols-2 gap-2">
              <Button variant="outline" :disabled="saving" @click="setListType('White')"><CheckCircle2 /> 加入白名单</Button>
              <Button variant="outline" :disabled="saving" @click="setListType('Block')"><Ban /> 加入黑名单</Button>
            </div>
          </div>

          <Button class="w-full" size="lg" :disabled="saving" @click="save"><LoaderCircle v-if="saving" class="animate-spin" /><Save v-else />{{ saving ? '保存中…' : '保存文件信息' }}</Button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
