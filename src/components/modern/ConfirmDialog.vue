<script setup lang="ts">
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'
import { Button } from '@/components/ui/button'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description: string
  confirmText?: string
  busy?: boolean
}>(), { confirmText: '' })

const emit = defineEmits<{ 'update:open': [value: boolean]; confirm: [] }>()
const { t } = useI18n()
</script>

<template>
  <AlertDialogRoot :open="props.open" @update:open="emit('update:open', $event)">
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in" />
      <AlertDialogContent class="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-xl">
        <AlertDialogTitle class="text-lg font-semibold">{{ title }}</AlertDialogTitle>
        <AlertDialogDescription class="mt-2 text-sm leading-6 text-muted-foreground">{{ description }}</AlertDialogDescription>
        <div class="mt-6 flex justify-end gap-2">
          <AlertDialogCancel as-child><Button variant="outline" :disabled="busy">{{ t('common.cancel') }}</Button></AlertDialogCancel>
          <AlertDialogAction as-child><Button variant="destructive" :disabled="busy" @click.prevent="emit('confirm')">{{ busy ? t('common.loading') : (confirmText || t('common.confirm')) }}</Button></AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
