<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import { get, post } from '../services/http';

const notices = ref([]);
const loading = ref(true);
const saving = ref(false);
const busyId = ref(null);
const keyword = ref('');
const statusFilter = ref('all');
const sorting = ref(false);
const sortDirty = ref(false);
const showForm = ref(false);
const previewContent = ref(false);
const tagInput = ref('');
const toast = reactive({ text: '', type: 'success' });
const form = reactive(defaultForm());

function defaultForm() { return { id: null, title: '', content: '', img_url: '', tags: [], show: 1, popup: 0 }; }
const filtered = computed(() => notices.value.filter((notice) => {
  const term = keyword.value.trim().toLowerCase();
  const matchText = !term || `${notice.title} ${notice.content} ${(notice.tags || []).join(' ')}`.toLowerCase().includes(term);
  const matchStatus = statusFilter.value === 'all' || Number(notice.show) === Number(statusFilter.value);
  return matchText && matchStatus;
}));
const stats = computed(() => ({ total: notices.value.length, visible: notices.value.filter((item) => Number(item.show)).length, popup: notices.value.filter((item) => Number(item.popup)).length }));

function notify(text, type = 'success') { toast.text = text; toast.type = type; window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => { toast.text = ''; }, 2800); }
async function load() { loading.value = true; try { notices.value = await get('/notice/fetch'); } catch (e) { notify(e.message, 'error'); } finally { loading.value = false; } }
function resetForm(source = {}) { Object.assign(form, defaultForm(), source, { tags: Array.isArray(source.tags) ? [...source.tags] : [] }); tagInput.value = ''; previewContent.value = false; }
function createNotice() { resetForm(); showForm.value = true; }
function editNotice(notice) { resetForm(notice); showForm.value = true; }
function closeForm() { showForm.value = false; resetForm(); }
function addTag() { const tag = tagInput.value.trim(); if (tag && !form.tags.includes(tag)) form.tags.push(tag); tagInput.value = ''; }
function removeTag(tag) { form.tags = form.tags.filter((item) => item !== tag); }
async function save() {
  if (!form.title.trim() || !form.content.trim()) { notify('标题和公告内容不能为空', 'error'); return; }
  saving.value = true;
  try { await post('/notice/save', { ...form, show: Number(form.show), popup: Number(form.popup) }); notify(form.id ? '公告已更新' : '公告已创建'); closeForm(); await load(); }
  catch (e) { notify(e.message, 'error'); } finally { saving.value = false; }
}
async function toggleShow(notice) {
  busyId.value = notice.id;
  try { await post('/notice/show', { id: notice.id }); notice.show = !notice.show; notify(notice.show ? '公告已显示' : '公告已隐藏'); }
  catch (e) { notify(e.message, 'error'); } finally { busyId.value = null; }
}
async function remove(notice) {
  if (!window.confirm(`确定删除公告「${notice.title}」？此操作无法撤销。`)) return;
  busyId.value = notice.id;
  try { await post('/notice/drop', { id: notice.id }); notify('公告已删除'); await load(); }
  catch (e) { notify(e.message, 'error'); } finally { busyId.value = null; }
}
function move(index, direction) {
  const target = index + direction; if (target < 0 || target >= notices.value.length) return;
  const next = [...notices.value]; [next[index], next[target]] = [next[target], next[index]]; notices.value = next; sortDirty.value = true;
}
async function saveSort() {
  saving.value = true;
  try { await post('/notice/sort', { ids: notices.value.map((item) => item.id) }); sortDirty.value = false; sorting.value = false; notify('公告排序已保存'); }
  catch (e) { notify(e.message, 'error'); } finally { saving.value = false; }
}
function formatTime(value) { return value ? new Date(Number(value) * 1000).toLocaleString('zh-CN', { hour12: false }) : '—'; }
onMounted(load);
</script>

<template>
  <section class="page-stack">
    <div class="page-heading page-heading-row"><div><h1>公告管理</h1><p>创建站内公告、控制显示与弹窗状态，并调整展示顺序。</p></div><button class="btn btn-primary" @click="createNotice"><AppIcon name="Plus" :size="16" />添加公告</button></div>
    <div class="stat-grid notice-stats"><article class="stat-card"><span>公告总数</span><strong>{{ stats.total }}</strong></article><article class="stat-card"><span>显示中</span><strong>{{ stats.visible }}</strong></article><article class="stat-card"><span>弹窗公告</span><strong>{{ stats.popup }}</strong></article></div>
    <div class="notice-toolbar"><label class="filter-input"><span>搜索</span><input v-model="keyword" placeholder="标题、内容或标签" /></label><label class="field compact-field"><span>显示状态</span><select v-model="statusFilter"><option value="all">全部状态</option><option value="1">显示中</option><option value="0">已隐藏</option></select></label><button class="btn btn-ghost" @click="sorting = !sorting; sortDirty = false">{{ sorting ? '退出排序' : '调整排序' }}</button><button v-if="sorting" class="btn btn-primary" :disabled="!sortDirty || saving" @click="saveSort">保存排序</button><button v-else class="btn btn-ghost" :disabled="loading" @click="load">刷新</button></div>
    <div v-if="loading" class="panel settings-loading">正在加载公告…</div>
    <div v-else-if="!filtered.length" class="panel settings-loading">暂无符合条件的公告</div>
    <div v-else class="notice-list">
      <article v-for="notice in filtered" :key="notice.id" class="panel notice-card">
        <div v-if="sorting" class="sort-controls"><button class="icon-button" title="上移" :disabled="notices.indexOf(notice) === 0" @click="move(notices.indexOf(notice), -1)"><AppIcon name="ArrowUp" :size="16" /></button><button class="icon-button" title="下移" :disabled="notices.indexOf(notice) === notices.length - 1" @click="move(notices.indexOf(notice), 1)"><AppIcon name="ArrowDown" :size="16" /></button></div>
        <div v-if="notice.img_url" class="notice-image"><img :src="notice.img_url" :alt="notice.title" /></div>
        <div class="notice-card-body"><div class="notice-heading"><div><h2>{{ notice.title }}</h2><span>#{{ notice.id }} · {{ formatTime(notice.updated_at || notice.created_at) }}</span></div><div class="notice-badges"><span class="status-pill" :class="{ off: !Number(notice.show) }">{{ Number(notice.show) ? '显示中' : '已隐藏' }}</span><span v-if="Number(notice.popup)" class="status-pill">弹窗</span></div></div><p class="notice-excerpt">{{ notice.content }}</p><div v-if="notice.tags?.length" class="tag-list"><span v-for="tag in notice.tags" :key="tag">{{ tag }}</span></div><div class="notice-actions"><button class="btn btn-ghost btn-sm" :disabled="busyId === notice.id" @click="toggleShow(notice)">{{ Number(notice.show) ? '隐藏' : '显示' }}</button><button class="btn btn-ghost btn-sm" @click="editNotice(notice)">编辑</button><button class="btn btn-danger btn-sm" :disabled="busyId === notice.id" @click="remove(notice)">删除</button></div></div>
      </article>
    </div>
    <div v-if="showForm" class="modal-backdrop" @click.self="closeForm"><section class="modal-card notice-modal"><div class="panel-head"><div><h2>{{ form.id ? '编辑公告' : '添加公告' }}</h2><p>内容支持 Markdown 或 HTML，由用户端主题负责渲染。</p></div><button class="btn btn-ghost" @click="closeForm">关闭</button></div><div class="smart-form"><label class="field field-wide"><span>公告标题</span><input v-model.trim="form.title" placeholder="请输入公告标题" /></label><label class="field field-wide"><span>公告背景图 URL</span><input v-model.trim="form.img_url" type="url" placeholder="https://example.com/image.jpg" /></label><label class="field"><span>显示状态</span><ToggleSwitch v-model="form.show" :true-value="1" :false-value="0" on-label="已显示" off-label="已隐藏" /></label><label class="field"><span>弹窗展示</span><ToggleSwitch v-model="form.popup" :true-value="1" :false-value="0" on-label="弹窗展示" off-label="不弹窗" /></label><label class="field field-wide"><span>公告标签</span><div class="tag-editor"><div class="tag-list"><button v-for="tag in form.tags" :key="tag" type="button" title="移除标签" @click="removeTag(tag)">{{ tag }} ×</button></div><input v-model="tagInput" placeholder="输入标签后按回车" @keydown.enter.prevent="addTag" @blur="addTag" /></div></label><label class="field field-wide"><span>公告内容</span><div class="editor-tabs"><button type="button" :class="{ active: !previewContent }" @click="previewContent = false">编辑</button><button type="button" :class="{ active: previewContent }" @click="previewContent = true">文本预览</button></div><textarea v-if="!previewContent" v-model="form.content" class="notice-content-editor" placeholder="请输入公告内容" /><pre v-else class="notice-content-preview">{{ form.content || '暂无内容' }}</pre></label><div v-if="form.img_url" class="field field-wide"><span>背景预览</span><img class="notice-form-image" :src="form.img_url" alt="公告背景预览" /></div></div><div class="modal-actions"><button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存公告' }}</button></div></section></div>
    <div v-if="toast.text" class="toast" :class="{ error: toast.type === 'error' }">{{ toast.text }}</div>
  </section>
</template>
