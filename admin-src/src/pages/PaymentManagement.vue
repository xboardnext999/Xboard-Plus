<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import SmartEditor from '../components/SmartEditor.vue';
import { get, post } from '../services/http';

const payments = ref([]); const methods = ref([]); const loading = ref(true); const saving = ref(false); const busyId = ref(null);
const keyword = ref(''); const statusFilter = ref('all'); const sorting = ref(false); const sortDirty = ref(false); const showForm = ref(false);
const configFields = ref([]); const toast = reactive({ text: '', type: 'success' }); const form = reactive(defaultForm());
function defaultForm() { return { id: null, name: '', icon: '', payment: '', notify_domain: '', handling_fee_fixed: 0, handling_fee_percent: 0, config: {} }; }
const filtered = computed(() => payments.value.filter((item) => {
  const term = keyword.value.trim().toLowerCase();
  return (!term || `${item.name} ${item.payment}`.toLowerCase().includes(term)) && (statusFilter.value === 'all' || Number(item.enable) === Number(statusFilter.value));
}));
const stats = computed(() => ({ total: payments.value.length, enabled: payments.value.filter((item) => Number(item.enable)).length, methods: new Set(payments.value.map((item) => item.payment)).size }));
function notify(text, type = 'success') { toast.text = text; toast.type = type; window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => { toast.text = ''; }, 2800); }
function normalizeOptions(options) { return Array.isArray(options) ? options.map((item) => typeof item === 'object' ? item : { value: item, label: item }) : Object.entries(options || {}).map(([value, label]) => ({ value, label })); }
function normalizeFields(schema) { return Object.entries(schema || {}).map(([key, field]) => ({ key, label: field.label || key, type: field.type === 'string' ? 'text' : field.type, placeholder: field.placeholder, help: field.description, required: Boolean(field.required), options: normalizeOptions(field.options) })); }
async function load() { loading.value = true; try { const [rows, available] = await Promise.all([get('/payment/fetch'), get('/payment/getPaymentMethods')]); payments.value = Array.isArray(rows) ? rows : []; methods.value = Array.isArray(available) ? available : []; } catch (e) { notify(e.message, 'error'); } finally { loading.value = false; } }
async function loadSchema(payment, id = null) {
  if (!payment) { configFields.value = []; form.config = {}; return; }
  try { const schema = await post('/payment/getPaymentForm', { payment, id }); configFields.value = normalizeFields(schema); form.config = Object.fromEntries(Object.entries(schema || {}).map(([key, field]) => [key, field.value ?? ''])); }
  catch (e) { configFields.value = []; notify(e.message, 'error'); }
}
async function createPayment() { Object.assign(form, defaultForm()); configFields.value = []; showForm.value = true; }
async function editPayment(item) { Object.assign(form, defaultForm(), item, { config: {} }); showForm.value = true; await loadSchema(item.payment, item.id); }
function closeForm() { showForm.value = false; Object.assign(form, defaultForm()); configFields.value = []; }
async function changeMethod() { await loadSchema(form.payment); }
async function save() {
  if (!form.name.trim() || !form.payment) return notify('请填写显示名称并选择支付网关', 'error');
  const missing = configFields.value.find((field) => field.required && (form.config[field.key] === '' || form.config[field.key] == null));
  if (missing) return notify(`请填写${missing.label}`, 'error');
  saving.value = true; try { await post('/payment/save', { ...form, handling_fee_fixed: Number(form.handling_fee_fixed || 0), handling_fee_percent: Number(form.handling_fee_percent || 0) }); notify(form.id ? '支付方式已更新' : '支付方式已添加'); closeForm(); await load(); } catch (e) { notify(e.message, 'error'); } finally { saving.value = false; }
}
async function toggle(item) { busyId.value = item.id; try { await post('/payment/show', { id: item.id }); item.enable = !item.enable; notify(item.enable ? '支付方式已启用' : '支付方式已停用'); } catch (e) { notify(e.message, 'error'); } finally { busyId.value = null; } }
async function remove(item) { if (!window.confirm(`确定删除支付方式「${item.name}」？删除后用户将无法使用。`)) return; busyId.value = item.id; try { await post('/payment/drop', { id: item.id }); notify('支付方式已删除'); await load(); } catch (e) { notify(e.message, 'error'); } finally { busyId.value = null; } }
function move(index, direction) { const target = index + direction; if (target < 0 || target >= payments.value.length) return; const next = [...payments.value]; [next[index], next[target]] = [next[target], next[index]]; payments.value = next; sortDirty.value = true; }
async function saveSort() { saving.value = true; try { await post('/payment/sort', { ids: payments.value.map((item) => item.id) }); sorting.value = false; sortDirty.value = false; notify('支付排序已保存'); } catch (e) { notify(e.message, 'error'); } finally { saving.value = false; } }
async function copyUrl(url) { try { await navigator.clipboard.writeText(url); notify('回调地址已复制'); } catch { notify('复制失败，请手动复制', 'error'); } }
onMounted(load);
</script>

<template>
  <section class="page-stack">
    <div class="page-heading page-heading-row"><div><h1>支付配置</h1><p>配置收款网关、手续费、回调地址与用户端可用状态。</p></div><button class="btn btn-primary" :disabled="!methods.length" @click="createPayment"><AppIcon name="Plus" :size="16" />添加支付方式</button></div>
    <div class="stat-grid payment-stats"><article class="stat-card"><span>支付方式</span><strong>{{ stats.total }}</strong></article><article class="stat-card"><span>已启用</span><strong>{{ stats.enabled }}</strong></article><article class="stat-card"><span>网关类型</span><strong>{{ stats.methods }}</strong></article></div>
    <div v-if="!loading && !methods.length" class="panel payment-tip">暂无可用支付网关，请先到“插件管理”安装并启用支付插件。</div>
    <div class="payment-toolbar"><label class="filter-input"><span>搜索</span><input v-model="keyword" placeholder="名称或网关代码" /></label><label class="field compact-field"><span>启用状态</span><select v-model="statusFilter"><option value="all">全部状态</option><option value="1">已启用</option><option value="0">已停用</option></select></label><button class="btn btn-ghost" @click="sorting = !sorting; sortDirty = false">{{ sorting ? '退出排序' : '调整排序' }}</button><button v-if="sorting" class="btn btn-primary" :disabled="!sortDirty || saving" @click="saveSort">保存排序</button><button v-else class="btn btn-ghost" :disabled="loading" @click="load">刷新</button></div>
    <div v-if="loading" class="panel settings-loading">正在加载支付配置…</div><div v-else-if="!filtered.length" class="panel settings-loading">暂无符合条件的支付方式</div>
    <div v-else class="payment-grid"><article v-for="item in filtered" :key="item.id" class="panel payment-card">
      <div v-if="sorting" class="sort-controls"><button class="icon-button" title="上移" :disabled="payments.indexOf(item) === 0" @click="move(payments.indexOf(item), -1)"><AppIcon name="ArrowUp" :size="16" /></button><button class="icon-button" title="下移" :disabled="payments.indexOf(item) === payments.length - 1" @click="move(payments.indexOf(item), 1)"><AppIcon name="ArrowDown" :size="16" /></button></div>
      <div class="payment-card-head"><div class="payment-icon">{{ item.icon || '¥' }}</div><div><h2>{{ item.name }}</h2><code>{{ item.payment }}</code></div><span class="status-pill" :class="{ off: !Number(item.enable) }">{{ Number(item.enable) ? '已启用' : '已停用' }}</span></div>
      <div class="payment-fees"><span>固定手续费<strong>¥ {{ (Number(item.handling_fee_fixed || 0) / 100).toFixed(2) }}</strong></span><span>比例手续费<strong>{{ Number(item.handling_fee_percent || 0) }}%</strong></span></div>
      <button class="payment-callback" title="点击复制" @click="copyUrl(item.notify_url)"><span>异步回调地址</span><code>{{ item.notify_url }}</code><AppIcon name="Copy" :size="15" /></button>
      <div class="payment-actions"><button class="btn btn-ghost btn-sm" :disabled="busyId === item.id" @click="toggle(item)">{{ Number(item.enable) ? '停用' : '启用' }}</button><button class="btn btn-ghost btn-sm" @click="editPayment(item)">编辑配置</button><button class="btn btn-danger btn-sm" :disabled="busyId === item.id" @click="remove(item)">删除</button></div>
    </article></div>
    <div v-if="showForm" class="modal-backdrop" @click.self="closeForm"><section class="modal-card payment-modal"><div class="panel-head"><div><h2>{{ form.id ? '编辑支付方式' : '添加支付方式' }}</h2><p>配置项由所选支付插件动态提供。</p></div><button class="btn btn-ghost" @click="closeForm">关闭</button></div><div class="smart-form">
      <label class="field"><span>显示名称</span><input v-model.trim="form.name" placeholder="例如：支付宝" /></label><label class="field"><span>支付网关</span><select v-model="form.payment" :disabled="Boolean(form.id)" @change="changeMethod"><option value="">请选择网关</option><option v-for="method in methods" :key="method" :value="method">{{ method }}</option></select><small v-if="form.id">已创建的支付方式不可切换网关</small></label>
      <label class="field"><span>图标</span><input v-model.trim="form.icon" placeholder="Emoji 或图标 URL" /></label><label class="field"><span>自定义回调域名</span><input v-model.trim="form.notify_domain" type="url" placeholder="https://pay.example.com" /><small>留空时使用当前站点域名</small></label>
      <label class="field"><span>固定手续费（分）</span><input v-model.number="form.handling_fee_fixed" type="number" min="0" step="1" /></label><label class="field"><span>比例手续费（%）</span><input v-model.number="form.handling_fee_percent" type="number" min="0" max="100" step="0.01" /></label>
    </div><div v-if="form.payment" class="gateway-config"><h3>网关参数</h3><SmartEditor v-if="configFields.length" v-model="form.config" :fields="configFields" /><div v-else class="settings-loading">正在读取或暂无网关参数…</div></div><div class="modal-actions"><button class="btn btn-primary" :disabled="saving || !form.payment" @click="save">{{ saving ? '保存中…' : '保存支付方式' }}</button></div></section></div>
    <div v-if="toast.text" class="toast" :class="{ error: toast.type === 'error' }">{{ toast.text }}</div>
  </section>
</template>
