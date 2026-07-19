<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import SmartEditor from '../components/SmartEditor.vue';
import { get, post } from '../services/http';

const themes = ref([]);
const activeName = ref('');
const loading = ref(true);
const uploading = ref(false);
const busyName = ref('');
const uploadInput = ref(null);
const modal = reactive({ type: '', theme: null, imageIndex: 0 });
const configModel = ref({});
const configFields = ref([]);
const toast = reactive({ text: '', type: 'success' });
const stats = computed(() => ({ total: themes.value.length, custom: themes.value.filter((item) => !item.is_system).length }));

function notify(text, type = 'success') { toast.text = text; toast.type = type; window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => { toast.text = ''; }, 2800); }
function imageList(theme) {
  if (Array.isArray(theme.images)) return theme.images.filter(Boolean);
  if (!theme.images) return [];
  if (typeof theme.images === 'string') return theme.images.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}
function imageUrl(theme, image) {
  if (/^(https?:|data:|\/)/.test(image)) return image;
  return `/theme/${theme.key}/${image}`;
}
async function load() {
  loading.value = true;
  try {
    const data = await get('/theme/getThemes'); activeName.value = data.active || '';
    themes.value = Object.entries(data.themes || {}).map(([key, value]) => ({ key, ...value }));
  } catch (e) { notify(e.message, 'error'); } finally { loading.value = false; }
}
async function activate(theme) {
  if (!window.confirm(`确定启用「${theme.name || theme.key}」主题？`)) return;
  busyName.value = theme.key;
  try { await post('/config/save', { frontend_theme: theme.key }); activeName.value = theme.key; notify('主题已启用'); await load(); }
  catch (e) { notify(e.message, 'error'); } finally { busyName.value = ''; }
}
function schemaField(item) {
  const options = Object.entries(item.select_options || {}).map(([value, label]) => ({ value, label }));
  const typeMap = { input: 'text', textarea: 'textarea', select: 'select', switch: 'boolean', boolean: 'boolean', number: 'number', color: 'color' };
  return { key: item.field_name, label: item.label || item.field_name, placeholder: item.placeholder, help: item.description, type: typeMap[item.field_type] || 'text', options };
}
async function configure(theme) {
  busyName.value = theme.key;
  try {
    const config = await post('/theme/getThemeConfig', { name: theme.key });
    configFields.value = (theme.configs || []).map(schemaField);
    configModel.value = Object.fromEntries(configFields.value.map((field) => [field.key, config?.[field.key] ?? theme.configs.find((item) => item.field_name === field.key)?.default_value ?? '']));
    modal.type = 'config'; modal.theme = theme;
  } catch (e) { notify(e.message, 'error'); } finally { busyName.value = ''; }
}
async function saveConfig() {
  busyName.value = modal.theme.key;
  try { await post('/theme/saveThemeConfig', { name: modal.theme.key, config: configModel.value }); notify('主题配置已保存'); modal.type = ''; await load(); }
  catch (e) { notify(e.message, 'error'); } finally { busyName.value = ''; }
}
function preview(theme) { modal.type = 'preview'; modal.theme = theme; modal.imageIndex = 0; }
async function remove(theme) {
  if (!window.confirm(`确定永久删除「${theme.name || theme.key}」主题？此操作无法撤销。`)) return;
  busyName.value = theme.key;
  try { await post('/theme/delete', { name: theme.key }); notify('主题已删除'); await load(); }
  catch (e) { notify(e.message, 'error'); } finally { busyName.value = ''; }
}
async function upload(event) {
  const file = event.target.files?.[0]; if (!file) return;
  if (!file.name.toLowerCase().endsWith('.zip')) { notify('仅支持 ZIP 主题包', 'error'); event.target.value = ''; return; }
  const body = new FormData(); body.append('file', file); uploading.value = true;
  try { await post('/theme/upload', body); notify('主题上传成功'); await load(); } catch (e) { notify(e.message, 'error'); }
  finally { uploading.value = false; event.target.value = ''; }
}
onMounted(load);
</script>

<template>
  <section class="page-stack">
    <div class="page-heading page-heading-row"><div><h1>主题配置</h1><p>管理用户端主题、外观配置和主题包。</p></div><div><input ref="uploadInput" hidden type="file" accept=".zip,application/zip" @change="upload" /><button class="btn btn-primary" :disabled="uploading" @click="uploadInput.click()"><AppIcon name="Upload" :size="16" />{{ uploading ? '上传中…' : '上传主题' }}</button></div></div>
    <div class="stat-grid theme-stats"><article class="stat-card"><span>可用主题</span><strong>{{ stats.total }}</strong></article><article class="stat-card"><span>自定义主题</span><strong>{{ stats.custom }}</strong></article><article class="stat-card"><span>当前主题</span><strong class="current-theme-name">{{ activeName || '—' }}</strong></article></div>
    <div v-if="loading" class="panel settings-loading">正在加载主题…</div>
    <div v-else-if="!themes.length" class="panel settings-loading">暂未发现有效主题</div>
    <div v-else class="theme-grid">
      <article v-for="theme in themes" :key="theme.key" class="panel theme-card" :class="{ active: activeName === theme.key }">
        <div class="theme-preview" :class="{ empty: !imageList(theme).length }"><img v-if="imageList(theme).length" :src="imageUrl(theme, imageList(theme)[0])" :alt="`${theme.name || theme.key} 预览`" /><div v-else><AppIcon name="PanelsTopLeft" :size="36" /><span>暂无预览图</span></div><span v-if="activeName === theme.key" class="theme-active-badge"><AppIcon name="Check" :size="14" />当前主题</span></div>
        <div class="theme-card-body"><div class="theme-title"><div><h2>{{ theme.name || theme.key }}</h2><code>{{ theme.key }}</code></div><span>v{{ theme.version || '1.0.0' }}</span></div><p>{{ theme.description || '暂无主题说明' }}</p><div class="theme-meta"><span>{{ theme.is_system ? '系统主题' : '自定义主题' }}</span><span v-if="theme.author">作者：{{ theme.author }}</span><span>{{ (theme.configs || []).length }} 个配置项</span></div><div class="theme-actions"><button v-if="imageList(theme).length" class="btn btn-ghost btn-sm" @click="preview(theme)">预览</button><button v-if="(theme.configs || []).length" class="btn btn-ghost btn-sm" :disabled="busyName === theme.key" @click="configure(theme)">主题设置</button><button v-if="activeName !== theme.key" class="btn btn-primary btn-sm" :disabled="busyName === theme.key" @click="activate(theme)">启用主题</button><button v-if="theme.can_delete && activeName !== theme.key" class="btn btn-danger btn-sm" :disabled="busyName === theme.key" @click="remove(theme)">删除</button></div></div>
      </article>
    </div>
    <div v-if="modal.type" class="modal-backdrop" @click.self="modal.type = ''"><section class="modal-card"><div class="panel-head"><div><h2>{{ modal.type === 'config' ? `配置 ${modal.theme.name || modal.theme.key}` : `${modal.theme.name || modal.theme.key} 预览` }}</h2><p v-if="modal.type === 'config'">修改主题的样式和显示选项。</p></div><button class="btn btn-ghost" @click="modal.type = ''">关闭</button></div><SmartEditor v-if="modal.type === 'config'" v-model="configModel" :fields="configFields" /><div v-else class="preview-gallery"><img :src="imageUrl(modal.theme, imageList(modal.theme)[modal.imageIndex])" alt="主题预览" /><div v-if="imageList(modal.theme).length > 1" class="gallery-controls"><button class="btn btn-ghost btn-sm" :disabled="modal.imageIndex === 0" @click="modal.imageIndex--">上一张</button><span>{{ modal.imageIndex + 1 }} / {{ imageList(modal.theme).length }}</span><button class="btn btn-ghost btn-sm" :disabled="modal.imageIndex >= imageList(modal.theme).length - 1" @click="modal.imageIndex++">下一张</button></div></div><div v-if="modal.type === 'config'" class="modal-actions"><button class="btn btn-primary" :disabled="busyName === modal.theme.key" @click="saveConfig">{{ busyName === modal.theme.key ? '保存中…' : '保存配置' }}</button></div></section></div>
    <div v-if="toast.text" class="toast" :class="{ error: toast.type === 'error' }">{{ toast.text }}</div>
  </section>
</template>
