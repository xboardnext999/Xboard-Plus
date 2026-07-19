<script setup>
defineProps({ rows: { type: Array, default: () => [] }, columns: { type: Array, default: () => [] }, loading: Boolean, editable: Boolean });
defineEmits(['edit', 'drop']);

function display(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
</script>

<template>
  <div class="table-scroll">
    <table class="data-table">
      <thead><tr><th v-for="column in columns" :key="column">{{ column }}</th><th v-if="editable">操作</th></tr></thead>
      <tbody>
        <tr v-if="loading"><td :colspan="columns.length + (editable ? 1 : 0)" class="empty-cell">正在加载…</td></tr>
        <tr v-else-if="!rows.length"><td :colspan="columns.length + (editable ? 1 : 0)" class="empty-cell">暂无数据</td></tr>
        <tr v-for="(row, index) in rows" v-else :key="row.id || row.trade_no || index">
          <td v-for="column in columns" :key="column" :title="display(row[column])"><span class="cell-value">{{ display(row[column]) }}</span></td>
          <td v-if="editable" class="table-actions"><button class="text-button" @click="$emit('edit', row)">编辑</button><button class="text-button danger" @click="$emit('drop', row)">删除</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
