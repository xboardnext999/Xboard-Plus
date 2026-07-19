<script setup>
import { onMounted, reactive, ref } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import { get, getEnvelope, post } from '../services/http';

const loading = ref(false), exporting = ref(false), resetting = ref(false), showReset = ref(false), detail = ref(null);
const rows = ref([]), stats = ref({}), toast = reactive({ text: '', type: 'success' });
const filters = reactive({ user_email: '', reset_type: '', trigger_source: '', start_date: '', end_date: '' });
const page = reactive({ current: 1, last: 1, total: 0, perPage: 20 });
const resetForm = reactive({ user_id: '', reason: '' });
const types = [['monthly', '按月重置'], ['first_day_month', '每月首日'], ['yearly', '按年重置'], ['first_day_year', '每年首日'], ['manual', '人工重置'], ['purchase', '购买触发']];
const sources = [['auto', '自动触发'], ['manual', '管理员手动'], ['api', 'API 调用'], ['cron', '定时任务'], ['user_access', '用户访问'], ['order', '订单触发'], ['gift_card', '礼品卡触发']];

function notify(text, type = 'success') { toast.text = text; toast.type = type; clearTimeout(notify.timer); notify.timer = setTimeout(() => { toast.text = ''; }, 3500); }
function params(extra = {}) { return Object.fromEntries(Object.entries({ ...filters, page: page.current, per_page: page.perPage, ...extra }).filter(([, v]) => v !== '' && v != null)); }
function time(value) { if (!value) return '—'; return new Date(value).toLocaleString('zh-CN', { hour12: false }); }
function bytes(value) { const n = Number(value || 0); if (!n) return '0 B'; const units = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), 4); return `${(n / 1024 ** i).toFixed(i > 1 ? 2 : 0)} ${units[i]}`; }
async function load(reset = false) {
  if (reset) page.current = 1; loading.value = true;
  try {
    const payload = await getEnvelope('/traffic-reset/logs', params());
    rows.value = payload.data || [];
    Object.assign(page, { current: Number(payload.pagination?.current_page || 1), last: Number(payload.pagination?.last_page || 1), total: Number(payload.pagination?.total || 0) });
  } catch (e) { notify(e.message, 'error'); rows.value = []; } finally { loading.value = false; }
}
async function loadStats() { try { stats.value = await get('/traffic-reset/stats', { days: 30 }); } catch (e) { notify(e.message, 'error'); } }
function clearFilters() { Object.assign(filters, { user_email: '', reset_type: '', trigger_source: '', start_date: '', end_date: '' }); load(true); }
async function resetUser() {
  if (!resetForm.user_id) return notify('请输入用户 ID', 'error');
  resetting.value = true;
  try { const result = await post('/traffic-reset/reset-user', { user_id: Number(resetForm.user_id), reason: resetForm.reason.trim() }); notify(`用户 ${result?.email || `#${resetForm.user_id}`} 流量已重置`); showReset.value = false; resetForm.user_id = ''; resetForm.reason = ''; await Promise.all([load(true), loadStats()]); }
  catch (e) { notify(e.message, 'error'); } finally { resetting.value = false; }
}
function csvCell(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
async function exportCsv() {
  exporting.value = true;
  try {
    const payload = await getEnvelope('/traffic-reset/logs', params({ page: 1, per_page: 10000 }));
    const head = ['日志ID', '用户ID', '用户邮箱', '重置类型', '触发来源', '重置前流量', '重置后流量', '重置时间'];
    const lines = [head, ...(payload.data || []).map((r) => [r.id, r.user_id, r.user_email, r.reset_type_name, r.trigger_source_name, r.old_traffic?.formatted, r.new_traffic?.formatted, r.reset_time])];
    const blob = new Blob([`\uFEFF${lines.map((line) => line.map(csvCell).join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `traffic-reset-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  } catch (e) { notify(e.message, 'error'); } finally { exporting.value = false; }
}
onMounted(() => Promise.all([load(), loadStats()]));
</script>

<template>
  <section class="page-stack traffic-reset-page">
    <div class="page-heading page-heading-row"><div><h1>流量重置日志</h1><p>追踪自动、定时和人工重置记录，核对用户重置前后的流量变化。</p></div><div class="heading-actions"><button class="btn btn-ghost" :disabled="exporting" @click="exportCsv">{{ exporting ? '导出中…' : '导出 CSV' }}</button><button class="btn btn-primary" @click="showReset = true">手动重置</button></div></div>
    <div class="reset-stat-grid"><article class="panel"><span>近 30 天重置</span><strong>{{ stats.total_resets || 0 }}</strong><small>全部触发来源</small></article><article class="panel auto"><span>自动重置</span><strong>{{ stats.auto_resets || 0 }}</strong><small>订阅周期自动执行</small></article><article class="panel cron"><span>定时任务</span><strong>{{ stats.cron_resets || 0 }}</strong><small>计划任务触发</small></article><article class="panel manual"><span>人工重置</span><strong>{{ stats.manual_resets || 0 }}</strong><small>管理员主动执行</small></article></div>
    <section class="panel reset-filter-panel"><div class="reset-filters"><label class="filter-input"><span>用户邮箱</span><input v-model.trim="filters.user_email" placeholder="输入完整或部分邮箱" @keyup.enter="load(true)" /></label><label class="field compact-field"><span>重置类型</span><select v-model="filters.reset_type"><option value="">全部类型</option><option v-for="item in types" :key="item[0]" :value="item[0]">{{ item[1] }}</option></select></label><label class="field compact-field"><span>触发来源</span><select v-model="filters.trigger_source"><option value="">全部来源</option><option v-for="item in sources" :key="item[0]" :value="item[0]">{{ item[1] }}</option></select></label><label class="field compact-field"><span>开始日期</span><input v-model="filters.start_date" type="date" /></label><label class="field compact-field"><span>结束日期</span><input v-model="filters.end_date" type="date" /></label><div class="reset-filter-actions"><button class="btn btn-ghost" @click="clearFilters">重置</button><button class="btn btn-primary" @click="load(true)">查询</button></div></div></section>
    <section class="panel table-wrap reset-table"><table><thead><tr><th>用户</th><th>重置类型</th><th>流量变化</th><th>触发来源</th><th>重置时间</th><th class="right">操作</th></tr></thead><tbody><tr v-if="loading"><td colspan="6" class="empty">正在加载重置日志…</td></tr><tr v-else-if="!rows.length"><td colspan="6" class="empty">暂无符合条件的重置记录</td></tr><tr v-for="row in rows" :key="row.id"><td><strong>{{ row.user_email }}</strong><small>#{{ row.user_id }} · 日志 #{{ row.id }}</small></td><td><span class="status-pill">{{ row.reset_type_name }}</span></td><td><div class="traffic-change"><span>{{ row.old_traffic?.formatted || bytes(row.old_traffic?.total) }}</span><AppIcon name="ArrowRight" :size="14"/><strong>{{ row.new_traffic?.formatted || bytes(row.new_traffic?.total) }}</strong></div><small>减少 {{ bytes(Math.max(0, Number(row.old_traffic?.total || 0) - Number(row.new_traffic?.total || 0))) }}</small></td><td><strong>{{ row.trigger_source_name }}</strong><small v-if="row.metadata?.reason">{{ row.metadata.reason }}</small></td><td>{{ time(row.reset_time) }}</td><td class="right"><button class="btn btn-ghost btn-sm" @click="detail = row">详情</button></td></tr></tbody></table></section>
    <div class="pagination"><span>共 {{ page.total }} 条</span><button class="btn btn-ghost btn-sm" :disabled="page.current <= 1 || loading" @click="page.current--; load()">上一页</button><span>{{ page.current }} / {{ page.last }}</span><button class="btn btn-ghost btn-sm" :disabled="page.current >= page.last || loading" @click="page.current++; load()">下一页</button></div>
    <div v-if="showReset" class="modal-backdrop" @click.self="showReset = false"><section class="modal-card reset-modal"><div class="panel-head"><div><h2>手动重置用户流量</h2><p>该操作会清零当前已用流量，并写入管理员操作记录。</p></div><button class="btn btn-ghost" @click="showReset = false">关闭</button></div><div class="manual-reset-warning"><AppIcon name="AlertTriangle" :size="18"/><span><strong>请确认用户 ID</strong><small>重置后无法从后台直接恢复，请在原因中写明操作依据。</small></span></div><div class="smart-form"><label class="field"><span>用户 ID *</span><input v-model="resetForm.user_id" type="number" min="1" placeholder="例如 1024" /></label><label class="field field-wide"><span>重置原因</span><textarea v-model="resetForm.reason" rows="4" maxlength="255" placeholder="例如：用户套餐补偿、异常流量修正" /></label></div><div class="modal-actions"><button class="btn btn-ghost" @click="showReset = false">取消</button><button class="btn btn-danger" :disabled="resetting || !resetForm.user_id" @click="resetUser">{{ resetting ? '正在重置…' : '确认重置流量' }}</button></div></section></div>
    <div v-if="detail" class="modal-backdrop" @click.self="detail = null"><section class="modal-card reset-detail"><div class="panel-head"><div><h2>重置日志 #{{ detail.id }}</h2><p>{{ detail.user_email }} · {{ time(detail.reset_time) }}</p></div><button class="btn btn-ghost" @click="detail = null">关闭</button></div><div class="reset-detail-grid"><span>用户<strong>#{{ detail.user_id }}</strong></span><span>类型<strong>{{ detail.reset_type_name }}</strong></span><span>来源<strong>{{ detail.trigger_source_name }}</strong></span><span>流量变化<strong>{{ detail.old_traffic?.formatted }} → {{ detail.new_traffic?.formatted }}</strong></span></div><h3>附加信息</h3><pre>{{ JSON.stringify(detail.metadata || {}, null, 2) }}</pre></section></div>
    <div v-if="toast.text" class="toast" :class="{ error: toast.type === 'error' }">{{ toast.text }}</div>
  </section>
</template>
