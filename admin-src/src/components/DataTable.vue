<script setup>
import AppIcon from './AppIcon.vue';
defineProps({ rows: { type: Array, default: () => [] }, columns: { type: Array, default: () => [] }, loading: Boolean, editable: Boolean, deletable: Boolean });
defineEmits(['edit', 'drop']);

const LABELS = { id: 'ID', name: '名称', title: '标题', email: '邮箱', trade_no: '订单号', user_id: '用户 ID', plan_id: '套餐 ID', group_id: '权限组', status: '状态', commission_status: '佣金状态', total_amount: '金额', balance: '余额', commission_balance: '佣金余额', transfer_enable: '流量', expired_at: '到期时间', created_at: '创建时间', updated_at: '更新时间', show: '显示', popup: '弹窗', banned: '封禁', type: '类型', host: '主机', port: '端口', is_online: '在线' };
const BOOL_KEYS = new Set(['show', 'popup', 'banned', 'enable', 'is_online', 'renew']);
function heading(key) { return LABELS[key] || key; }

function display(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function cell(row, column) {
  const value = row[column];
  if (BOOL_KEYS.has(column)) return Number(value) ? '是' : '否';
  if (['total_amount', 'balance', 'commission_balance'].includes(column) && value !== undefined) return `¥${(Number(value || 0) / 100).toFixed(2)}`;
  if (['created_at', 'updated_at', 'expired_at'].includes(column) && Number(value) > 1000000000) return new Date(Number(value) * 1000).toLocaleString('zh-CN', { hour12: false });
  return display(value);
}
</script>

<template>
  <div class="table-scroll">
    <table class="data-table">
      <thead><tr><th v-for="column in columns" :key="column">{{ heading(column) }}</th><th v-if="editable || deletable">操作</th></tr></thead>
      <tbody>
        <tr v-if="loading"><td :colspan="columns.length + (editable || deletable ? 1 : 0)" class="empty-cell"><span class="table-state loading"><AppIcon name="LoaderCircle" :size="20" /><strong>正在加载</strong><small>正在获取最新数据…</small></span></td></tr>
        <tr v-else-if="!rows.length"><td :colspan="columns.length + (editable || deletable ? 1 : 0)" class="empty-cell"><span class="table-state"><AppIcon name="Inbox" :size="22" /><strong>暂无数据</strong><small>当前条件下没有可显示的记录</small></span></td></tr>
        <tr v-for="(row, index) in rows" v-else :key="row.id || row.trade_no || index">
          <td v-for="column in columns" :key="column" :title="cell(row, column)"><span v-if="BOOL_KEYS.has(column)" class="status-pill" :class="{ off: !Number(row[column]) }">{{ cell(row, column) }}</span><span v-else class="cell-value">{{ cell(row, column) }}</span></td>
          <td v-if="editable || deletable" class="table-actions"><button v-if="editable" class="text-button" @click="$emit('edit', row)">编辑</button><button v-if="deletable" class="text-button danger" @click="$emit('drop', row)">删除</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
