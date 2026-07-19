<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { default: false },
  trueValue: { default: true },
  falseValue: { default: false },
  onLabel: { type: String, default: '已开启' },
  offLabel: { type: String, default: '已关闭' },
  disabled: Boolean,
});
const emit = defineEmits(['update:modelValue']);
const enabled = computed(() => props.modelValue === true || props.modelValue === 1 || props.modelValue === '1');
function toggle() { if (!props.disabled) emit('update:modelValue', enabled.value ? props.falseValue : props.trueValue); }
</script>

<template>
  <button type="button" class="toggle-switch" :class="{ enabled }" role="switch" :aria-checked="enabled" :disabled="disabled" @click="toggle">
    <span class="toggle-track" aria-hidden="true"><i /></span><span class="toggle-state">{{ enabled ? onLabel : offLabel }}</span>
  </button>
</template>
