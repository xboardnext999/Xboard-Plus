<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import SmartEditor from '../components/SmartEditor.vue';
import { get, post } from '../services/http';

const plugins = ref([]);
const types = ref([]);
const loading = ref(true);
const busyCode = ref('');
const keyword = ref('');
const typeFilter = ref('');
const statusFilter = ref('all');
const uploadInput = ref(null);
const uploading = ref(false);
const modal = reactive({ type: '', plugin: null });
const configModel = ref({});
const configFields = ref([]);
const toast = reactive({ text: '', type: 'success' });

const filtered = computed(() => plugins.value.filter((plugin) => {
  const term = keyword.value.trim().toLowerCase();
  const matchesText = !term || `${plugin.name} ${plugin.code} ${plugin.description} ${plugin.author}`.toLowerCase().includes(term);
  const matchesType = !typeFilter.value || plugin.type === typeFilter.value;
  const matchesStatus = statusFilter.value === 'all' || (statusFilter.value === 'installed' ? plugin.is_installed : !plugin.is_installed);
  return matchesText && matchesType && matchesStatus;
}));
const counts = computed(() => ({ all: plugins.value.length, installed: plugins.value.filter((item) => item.is_installed).length, enabled: plugins.value.filter((item) => item.is_enabled).length }));

function notify(text, type = 'success') { toast.text = text; toast.type = type; window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => { toast.text = ''; }, 2800); }
async function load() {
  loading.value = true;
  try { const [pluginData, typeData] = await Promise.all([get('/plugin/getPlugins'), get('/plugin/types')]); plugins.value = Array.isArray(pluginData) ? pluginData : []; types.value = Array.isArray(typeData) ? typeData : []; }
  catch (e) { notify(e.message, 'error'); } finally { loading.value = false; }
}
async function action(plugin, name, prompt = '') {
  if (prompt && !window.confirm(prompt)) return;
  busyCode.value = plugin.code;
  try { await post(`/plugin/${name}`, { code: plugin.code }); notify({ install: '安装', uninstall: '卸载', enable: '启用', disable: '禁用', upgrade: '升级', delete: '删除' }[name] + '成功'); await load(); }
  catch (e) { notify(e.message, 'error'); } finally { busyCode.value = ''; }
}
function openReadme(plugin) { modal.type = 'readme'; modal.plugin = plugin; }
function normalizeOptions(options) {
  if (Array.isArray(options)) return options.map((option) => typeof option === 'object' ? option : { value: option, label: option });
  return Object.entries(options || {}).map(([value, label]) => ({ value, label }));
}
async function openConfig(plugin) {
  busyCode.value = plugin.code;
  try {
    const config = await get('/plugin/config', { code: plugin.code });
    configModel.value = Object.fromEntries(Object.entries(config).map(([key, item]) => [key, item.value]));
    configFields.value = Object.entries(config).map(([key, item]) => ({ key, label: item.label || key, placeholder: item.placeholder, help: item.description, type: item.type === 'text' ? 'textarea' : item.type === 'string' ? 'text' : item.type, options: normalizeOptions(item.options) }));
    modal.type = 'config'; modal.plugin = plugin;
  } catch (e) { notify(e.message, 'error'); } finally { busyCode.value = ''; }
}
async function saveConfig() {
  busyCode.value = modal.plugin.code;
  try { await post('/plugin/config', { code: modal.plugin.code, config: configModel.value }); notify('插件配置已保存'); modal.type = ''; await load(); }
  catch (e) { notify(e.message, 'error'); } finally { busyCode.value = ''; }
}
async function upload(event) {
  const file = event.target.files?.[0]; if (!file) return;
  if (!file.name.toLowerCase().endsWith('.zip')) { notify('仅支持 ZIP 插件包', 'error'); event.target.value = ''; return; }
  const body = new FormData(); body.append('file', file); uploading.value = true;
  try { await post('/plugin/upload', body); notify('插件上传成功'); await load(); } catch (e) { notify(e.message, 'error'); }
  finally { uploading.value = false; event.target.value = ''; }
}
function typeName(value) { return types.value.find((item) => item.value === value)?.label || (value === 'payment' ? '支付方式' : '功能'); }
onMounted(load);
</script>

<template>
  <section class="page-stack">
    <div class="page-heading page-heading-row"><div><h1>插件管理</h1><p>安装、启用和配置功能扩展与支付插件。</p></div><div><input ref="uploadInput" hidden type="file" accept=".zip,application/zip" @change="upload" /><button class="btn btn-primary" :disabled="uploading" @click="uploadInput.click()"><AppIcon name="Upload" :size="16" />{{ uploading ? '上传中…' : '上传插件' }}</button></div></div>
    <div class="stat-grid plugin-stats"><article class="stat-card"><span>全部插件</span><strong>{{ counts.all }}</strong></article><article class="stat-card"><span>已安装</span><strong>{{ counts.installed }}</strong></article><article class="stat-card"><span>已启用</span><strong>{{ counts.enabled }}</strong></article></div>
    <div class="plugin-toolbar"><label class="filter-input"><span>搜索</span><input v-model="keyword" placeholder="插件名称、代码或描述" /></label><label class="field compact-field"><span>插件类型</span><select v-model="typeFilter"><option value="">全部类型</option><option v-for="type in types" :key="type.value" :value="type.value">{{ type.icon }} {{ type.label }}</option></select></label><label class="field compact-field"><span>安装状态</span><select v-model="statusFilter"><option value="all">全部状态</option><option value="installed">已安装</option><option value="available">可安装</option></select></label><button class="btn btn-ghost" :disabled="loading" @click="load">刷新</button></div>
    <div v-if="loading" class="panel settings-loading">正在加载插件…</div>
    <div v-else-if="!filtered.length" class="panel settings-loading">没有符合条件的插件</div>
    <div v-else class="plugin-grid">
      <article v-for="plugin in filtered" :key="plugin.code" class="panel plugin-card">
        <div class="plugin-card-head"><div class="plugin-icon"><AppIcon :name="plugin.type === 'payment' ? 'CreditCard' : 'Puzzle'" :size="23" /></div><div class="plugin-identity"><div><h2>{{ plugin.name }}</h2><span>v{{ plugin.version }}</span></div><code>{{ plugin.code }}</code></div><span class="status-pill" :class="{ off: !plugin.is_enabled }">{{ !plugin.is_installed ? '未安装' : plugin.is_enabled ? '已启用' : '已禁用' }}</span></div>
        <p class="plugin-description">{{ plugin.description || '暂无插件说明' }}</p>
        <div class="plugin-meta"><span>{{ typeName(plugin.type) }}</span><span>作者：{{ plugin.author || '未知' }}</span><span v-if="plugin.is_protected">核心插件</span><span v-if="plugin.need_upgrade" class="upgrade-label">可升级</span></div>
        <div class="plugin-actions">
          <button v-if="plugin.readme" class="btn btn-ghost btn-sm" @click="openReadme(plugin)">文档</button>
          <button v-if="!plugin.is_installed" class="btn btn-primary btn-sm" :disabled="busyCode === plugin.code" @click="action(plugin, 'install')">安装</button>
          <template v-else><button v-if="Object.keys(plugin.config || {}).length" class="btn btn-ghost btn-sm" :disabled="busyCode === plugin.code" @click="openConfig(plugin)">配置</button><button v-if="plugin.need_upgrade" class="btn btn-ghost btn-sm" :disabled="busyCode === plugin.code" @click="action(plugin, 'upgrade', `确定升级「${plugin.name}」？`)">升级</button><button v-if="plugin.is_enabled" class="btn btn-ghost btn-sm" :disabled="busyCode === plugin.code" @click="action(plugin, 'disable')">禁用</button><button v-else class="btn btn-primary btn-sm" :disabled="busyCode === plugin.code" @click="action(plugin, 'enable')">启用</button><button v-if="!plugin.is_enabled" class="btn btn-danger btn-sm" :disabled="busyCode === plugin.code" @click="action(plugin, 'uninstall', `确定卸载「${plugin.name}」？插件数据可能被清除。`)">卸载</button></template>
          <button v-if="!plugin.is_installed && plugin.can_be_deleted" class="btn btn-danger btn-sm" :disabled="busyCode === plugin.code" @click="action(plugin, 'delete', `确定永久删除「${plugin.name}」的插件文件？`)">删除</button>
        </div>
      </article>
    </div>
    <div v-if="modal.type" class="modal-backdrop" @click.self="modal.type = ''"><section class="modal-card"><div class="panel-head"><div><h2>{{ modal.type === 'config' ? `配置 ${modal.plugin.name}` : modal.plugin.name }}</h2><p v-if="modal.type === 'config'">配置只对当前插件生效。</p></div><button class="btn btn-ghost" @click="modal.type = ''">关闭</button></div><SmartEditor v-if="modal.type === 'config'" v-model="configModel" :fields="configFields" /><pre v-else class="readme-content">{{ modal.plugin.readme }}</pre><div v-if="modal.type === 'config'" class="modal-actions"><button class="btn btn-primary" :disabled="busyCode === modal.plugin.code" @click="saveConfig">{{ busyCode === modal.plugin.code ? '保存中…' : '保存配置' }}</button></div></section></div>
    <div v-if="toast.text" class="toast" :class="{ error: toast.type === 'error' }">{{ toast.text }}</div>
  </section>
</template>
