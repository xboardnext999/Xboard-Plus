<script setup>
import { computed, onMounted, ref } from 'vue';
import { get, post } from '../services/http';

const products = ref([]), selectedId = ref(''), items = ref([]), loading = ref(false), importing = ref(false), stockText = ref(''), stockPackage = ref('');
const selectedProduct = computed(() => products.value.find((item) => String(item.id) === String(selectedId.value)) || null);
const available = computed(() => items.value.filter((item) => item.status === 'available').length);
const sold = computed(() => items.value.filter((item) => item.status === 'sold').length);
function packageName(id) { return selectedProduct.value?.product_config?.packages?.find((item) => String(item.id) === String(id))?.name || '通用库存'; }
async function loadProducts() { const data = await get('/digital-products/fetch'); products.value = Array.isArray(data) ? data : []; if (!selectedId.value && products.value[0]) selectedId.value = products.value[0].id; }
async function loadStock() { if (!selectedId.value) { items.value = []; return; } loading.value = true; try { const data = await get(`/digital-products/stock?plan_id=${selectedId.value}`); items.value = Array.isArray(data) ? data : []; } finally { loading.value = false; } }
async function importStock() { if (!selectedProduct.value || !stockText.value.trim()) return; importing.value = true; try { await post('/digital-products/stock/import', { plan_id: selectedProduct.value.id, package_id: stockPackage.value || null, content: stockText.value }); stockText.value = ''; stockPackage.value = ''; await loadStock(); await loadProducts(); } finally { importing.value = false; } }
async function remove(item) { if (item.status !== 'available' || !window.confirm('确定删除这条未售库存吗？')) return; await post('/digital-products/stock/drop', { id: item.id }); items.value = items.value.filter((row) => row.id !== item.id); }
onMounted(async () => { await loadProducts(); await loadStock(); });
</script>
<template>
  <section class="page-stack">
    <div class="page-heading"><div><h1>库存管理</h1><p>统一管理数字商品库存、套餐归属和交付状态。</p></div></div>
    <div class="panel digital-inventory-toolbar"><label class="field"><span>选择商品</span><select v-model="selectedId" @change="loadStock"><option value="">请选择数字商品</option><option v-for="product in products" :key="product.id" :value="product.id">{{ product.name }}</option></select></label><label v-if="selectedProduct" class="field"><span>导入到套餐</span><select v-model="stockPackage"><option value="">通用库存</option><option v-for="item in (selectedProduct.product_config?.packages || [])" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><button class="btn btn-primary" :disabled="importing || !selectedProduct || !stockText.trim()" @click="importStock">{{ importing ? '导入中…' : '导入库存' }}</button></div>
    <div v-if="selectedProduct" class="stat-grid"><article class="stat-card"><span>库存总数</span><strong>{{ items.length }}</strong></article><article class="stat-card"><span>可交付</span><strong>{{ available }}</strong></article><article class="stat-card"><span>已交付</span><strong>{{ sold }}</strong></article></div>
    <div class="panel digital-inventory-import"><textarea v-model="stockText" rows="4" placeholder="每行一条库存内容，例如：CODE-001&#10;CODE-002" /></div>
    <div class="panel digital-inventory-table"><div class="panel-head"><div><h2>{{ selectedProduct?.name || '库存记录' }}</h2><p>已售库存仅保留记录，不允许删除。</p></div><span>{{ items.length }} 条记录</span></div><div v-if="loading" class="settings-loading">正在加载库存…</div><div v-else-if="!items.length" class="settings-loading">暂无库存记录</div><div v-else class="digital-stock-list"><div v-for="item in items" :key="item.id" class="digital-stock-row"><div><strong>{{ item.content }}</strong><small>{{ packageName(item.package_id) }} · {{ item.status === 'available' ? '未交付' : '已交付' }}</small></div><button v-if="item.status === 'available'" class="btn btn-danger btn-sm" @click="remove(item)">删除</button></div></div></div>
  </section>
</template>
