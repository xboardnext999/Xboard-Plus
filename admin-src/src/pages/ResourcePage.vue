<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import DataTable from '../components/DataTable.vue';
import { resourceFor } from '../config/resources';
import { get, post } from '../services/http';

const route = useRoute();
const loading = ref(false);
const saving = ref(false);
const rows = ref([]);
const error = ref('');
const keyword = ref('');
const showEditor = ref(false);
const draft = ref('{}');
const page = reactive({ current: 1, size: 20, total: 0 });
const config = computed(() => resourceFor(route.path) || { title: route.meta.title, endpoint: '' });
const columns = computed(() => config.value.rowKeys || Object.keys(rows.value[0] || {}).slice(0, 7));
const filteredRows = computed(() => {
  const term = keyword.value.trim().toLowerCase();
  if (!term) return rows.value;
  return rows.value.filter((row) => JSON.stringify(row).toLowerCase().includes(term));
});

function normalize(data) {
  const source = data?.data ?? data;
  const list = source?.items || source?.list || source?.data || source;
  if (route.path === '/system/config' && list && !Array.isArray(list)) {
    rows.value = Object.entries(list).map(([key, value]) => ({ key, value }));
  } else {
    rows.value = Array.isArray(list) ? list : Array.isArray(source) ? source : [];
  }
  page.total = Number(source?.total || source?.pagination?.total || rows.value.length);
  page.current = Number(source?.current_page || source?.current || page.current);
}

async function load() {
  if (!config.value.endpoint) return;
  loading.value = true; error.value = '';
  try { normalize(await get(config.value.endpoint, { current: page.current, pageSize: page.size })); }
  catch (e) { error.value = e.message; rows.value = []; }
  finally { loading.value = false; }
}

function edit(row = {}) { draft.value = JSON.stringify(row, null, 2); showEditor.value = true; }
async function save() {
  try {
    saving.value = true; error.value = '';
    let body = JSON.parse(draft.value);
    if (route.path === '/system/config' && Object.hasOwn(body, 'key')) body = { [body.key]: body.value };
    await post(config.value.save, body); showEditor.value = false; await load();
  } catch (e) { error.value = e instanceof SyntaxError ? 'JSON 格式不正确' : e.message; }
  finally { saving.value = false; }
}
async function drop(row) {
  if (!window.confirm(`确定删除 ID ${row.id}？`)) return;
  try { await post(config.value.drop, { id: row.id }); await load(); } catch (e) { error.value = e.message; }
}

watch(() => route.path, () => { page.current = 1; keyword.value = ''; load(); });
onMounted(load);
</script>

<template>
  <section class="page-stack">
    <div class="page-heading page-heading-row"><div><h1>{{ config.title }}</h1><p>数据直接来自 Xboard Plus 管理接口。</p></div><button v-if="config.save" class="btn btn-primary" @click="edit()">新建</button></div>
    <div class="toolbar"><label class="filter-input"><span>搜索</span><input v-model="keyword" placeholder="筛选当前数据" /></label><button class="btn btn-ghost" :disabled="loading" @click="load">刷新</button></div>
    <p v-if="error" class="alert alert-error">{{ error }}</p>
    <section class="panel table-panel"><DataTable :rows="filteredRows" :columns="columns" :loading="loading" :editable="Boolean(config.save)" @edit="edit" @drop="drop" /></section>
    <div v-if="config.paginated" class="pagination"><button class="btn btn-ghost" :disabled="page.current <= 1" @click="page.current--; load()">上一页</button><span>第 {{ page.current }} 页 · 共 {{ page.total }} 条</span><button class="btn btn-ghost" :disabled="rows.length < page.size" @click="page.current++; load()">下一页</button></div>
    <div v-if="showEditor" class="modal-backdrop" @click.self="showEditor = false"><section class="modal-card"><div class="panel-head"><div><h2>编辑 {{ config.title }}</h2><p>完整字段以 JSON 保存，避免迁移时丢失插件扩展字段。</p></div><button class="btn btn-ghost" @click="showEditor = false">关闭</button></div><textarea v-model="draft" class="json-editor" spellcheck="false" /><div class="modal-actions"><button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button></div></section></div>
  </section>
</template>
