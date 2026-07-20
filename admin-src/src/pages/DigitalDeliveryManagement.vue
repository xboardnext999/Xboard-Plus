<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { get, request } from '../services/http';

const rows = ref([]), products = ref([]), loading = ref(false), detail = ref(null);
const filters = reactive({ keyword: '', plan_id: '' });
const page = reactive({ current: 1, size: 20, total: 0, last: 1 });
const deliveredToday = computed(() => { const start = new Date(); start.setHours(0, 0, 0, 0); return rows.value.filter((item) => Number(item.sold_at) * 1000 >= start.getTime()).length; });
function formatTime(value) { return value ? new Date(Number(value) * 1000).toLocaleString('zh-CN', { hour12: false }) : '-'; }
function packageName(item) { return item.plan?.product_config?.packages?.find((pkg) => String(pkg.id) === String(item.package_id))?.name || '通用库存'; }
async function load(reset = false) { if (reset) page.current = 1; loading.value = true; try { const params = new URLSearchParams({ current: page.current, pageSize: page.size }); if (filters.keyword) params.set('keyword', filters.keyword); if (filters.plan_id) params.set('plan_id', filters.plan_id); const data = await request(`/digital-products/deliveries?${params}`); const source = data?.data ?? data; rows.value = source?.items || source?.data || (Array.isArray(source) ? source : []); page.total = Number(source?.total || rows.value.length); page.last = Number(source?.last_page || Math.max(1, Math.ceil(page.total / page.size))); } finally { loading.value = false; } }
async function loadProducts() { const data = await get('/digital-products/fetch'); products.value = Array.isArray(data) ? data : []; }
onMounted(() => Promise.all([load(true), loadProducts()]));
</script>
<template>
  <section class="page-stack">
    <div class="page-heading"><div><h1>交付记录</h1><p>查看数字商品实际交付内容、购买用户和关联订单。</p></div></div>
    <div class="stat-grid"><article class="stat-card"><span>交付记录</span><strong>{{ page.total }}</strong></article><article class="stat-card"><span>本页交付</span><strong>{{ rows.length }}</strong></article><article class="stat-card"><span>今日交付</span><strong>{{ deliveredToday }}</strong></article></div>
    <div class="panel digital-delivery-filters"><label class="field"><span>搜索</span><input v-model.trim="filters.keyword" placeholder="邮箱、订单号或交付内容" @keyup.enter="load(true)" /></label><label class="field"><span>数字商品</span><select v-model="filters.plan_id" @change="load(true)"><option value="">全部商品</option><option v-for="item in products" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><button class="btn btn-primary" @click="load(true)">查询</button></div>
    <div class="panel digital-delivery-table"><div v-if="loading" class="settings-loading">正在加载交付记录…</div><div v-else-if="!rows.length" class="settings-loading">暂无交付记录</div><div v-else class="digital-stock-list"><div v-for="item in rows" :key="item.id" class="digital-stock-row"><div><strong>{{ item.plan?.name || '已删除商品' }} · {{ packageName(item) }}</strong><small>{{ item.user?.email || `用户 #${item.user_id}` }} · {{ item.order?.trade_no || `订单 #${item.order_id}` }} · {{ formatTime(item.sold_at) }}</small></div><button class="btn btn-ghost btn-sm" @click="detail = item">查看内容</button></div></div><div v-if="page.last > 1" class="modal-actions"><button class="btn btn-ghost btn-sm" :disabled="page.current <= 1" @click="page.current--; load()">上一页</button><span>{{ page.current }} / {{ page.last }}</span><button class="btn btn-ghost btn-sm" :disabled="page.current >= page.last" @click="page.current++; load()">下一页</button></div></div>
    <div v-if="detail" class="modal-backdrop" @click.self="detail = null"><section class="modal-card"><div class="panel-head"><div><h2>交付内容</h2><p>{{ detail.plan?.name }} · {{ packageName(detail) }}</p></div><button class="btn btn-ghost" @click="detail = null">关闭</button></div><pre class="digital-delivery-content">{{ detail.content }}</pre></section></div>
  </section>
</template>
