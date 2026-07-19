<script setup>
import { computed } from 'vue';

const props = defineProps({ modelValue: { type: Object, required: true }, fields: { type: Array, default: () => [] } });
const emit = defineEmits(['update:modelValue']);

const LABELS = {
  id: 'ID', name: '名称', title: '标题', email: '邮箱', password: '新密码', content: '内容', remarks: '备注',
  status: '状态', show: '显示', popup: '弹窗展示', banned: '封禁', is_admin: '管理员', is_staff: '员工', enable: '启用',
  plan_id: '套餐 ID', group_id: '权限组 ID', transfer_enable: '流量配额', speed_limit: '限速', device_limit: '设备数限制',
  capacity_limit: '容量限制', balance: '余额', commission_balance: '佣金余额', commission_rate: '佣金比例', discount: '专属折扣',
  commission_status: '佣金状态', prices: '周期价格', tags: '标签', img_url: '图片地址', host: '主机', port: '端口', type: '类型',
};
const LONG = new Set(['content', 'remarks', 'description']);
const SECRET = new Set(['password', 'token', 'secret']);
const entries = computed(() => props.fields.map((field) => ({ key: typeof field === 'string' ? field : field.key, ...(typeof field === 'object' ? field : {}) })));

function label(field) { return field.label || LABELS[field.key] || field.key; }
function value(field) { return props.modelValue[field.key]; }
function kind(field) {
  if (field.type) return field.type;
  const current = value(field);
  if (typeof current === 'boolean' || [0, 1].includes(current) && /^(show|popup|enable|banned|is_|renew)/.test(field.key)) return 'boolean';
  if (current && typeof current === 'object') return 'json';
  if (LONG.has(field.key)) return 'textarea';
  if (SECRET.has(field.key)) return 'password';
  if (typeof current === 'number' || /(_id|_limit|_rate|_amount|_balance|_enable|^port$)/.test(field.key)) return 'number';
  return 'text';
}
function lineValue(field) { const current = value(field); return Array.isArray(current) ? current.join('\n') : (current || ''); }
function update(key, next) { emit('update:modelValue', { ...props.modelValue, [key]: next }); }
function updateJson(field, raw) { try { update(field.key, JSON.parse(raw)); } catch { update(field.key, raw); } }
function jsonValue(field) { const current = value(field); return typeof current === 'string' ? current : JSON.stringify(current ?? {}, null, 2); }
</script>

<template>
  <div class="smart-form">
    <label v-for="field in entries" :key="field.key" class="field" :class="{ 'field-wide': ['textarea', 'json'].includes(kind(field)) }">
      <span>{{ label(field) }}</span>
      <ToggleSwitch v-if="kind(field) === 'boolean'" :model-value="Number(value(field) || 0)" :true-value="1" :false-value="0" :disabled="field.readonly" :on-label="field.onLabel || '已开启'" :off-label="field.offLabel || '已关闭'" @update:model-value="update(field.key, $event)" />
      <select v-else-if="kind(field) === 'select'" :disabled="field.readonly" :value="value(field)" @change="update(field.key, field.options.find((option) => String(option.value) === $event.target.value)?.value)"><option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option></select>
      <textarea v-else-if="kind(field) === 'lines'" :disabled="field.readonly" :value="lineValue(field)" rows="5" @input="update(field.key, $event.target.value.split('\n').map((line) => line.trim()).filter(Boolean))" />
      <textarea v-else-if="kind(field) === 'textarea'" :disabled="field.readonly" :value="value(field) || ''" rows="5" @input="update(field.key, $event.target.value)" />
      <textarea v-else-if="kind(field) === 'json'" :disabled="field.readonly" :value="jsonValue(field)" rows="7" class="code-input" @change="updateJson(field, $event.target.value)" />
      <input v-else :disabled="field.readonly" :type="kind(field)" :value="value(field) ?? ''" :placeholder="field.placeholder || ''" @input="update(field.key, kind(field) === 'number' && $event.target.value !== '' ? Number($event.target.value) : $event.target.value)" />
      <small v-if="field.help">{{ field.help }}</small>
    </label>
  </div>
</template>
