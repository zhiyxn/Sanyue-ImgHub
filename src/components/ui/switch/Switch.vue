<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'
defineProps<{ modelValue?: boolean; disabled?: boolean }>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>
<template>
  <SwitchRoot :model-value="modelValue" :disabled="disabled" class="focus-ring inline-flex h-6 w-11 items-center rounded-full border border-transparent bg-input transition-colors data-[state=checked]:bg-primary" @update:model-value="$emit('update:modelValue', $event)">
    <SwitchThumb class="pointer-events-none block size-5 translate-x-0 rounded-full bg-background shadow-sm transition-transform data-[state=checked]:translate-x-5" />
  </SwitchRoot>
</template>
