<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import AppIcon from '../components/AppIcon.vue';
import { get } from '../services/http';

const stats = ref({});
const orders = ref([]);
const loading = ref(true);
const refreshing = ref(false);
const error = ref('');
const updatedAt = ref(null);

const money = (value) => `¥${(Number(value || 0) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number = (value) => Number(value || 0).toLocaleString('zh-CN');
const traffic = (value) => {
  let n = Number(value || 0); const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']; let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
};
const growth = (value) => `${Number(value || 0) > 0 ? '+' : ''}${Number(value || 0).toFixed(1)}%`;
const growthClass = (value) => Number(value || 0) > 0 ? 'up' : Number(value || 0) < 0 ? 'down' : 'flat';
const dateText = () => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date());

const orderMax = computed(() => Math.max(...orders.value.map(item => Number(item.paid_total || 0)), 1));
const chartPoints = computed(() => orders.value.map((item, index) => {
  const width = 620; const height = 180; const count = Math.max(orders.value.length - 1, 1);
  return `${(index / count) * width},${height - (Number(item.paid_total || 0) / orderMax.value) * 150}`;
}).join(' '));
const total14 = computed(() => orders.value.reduce((sum, item) => sum + Number(item.paid_total || 0), 0));
const count14 = computed(() => orders.value.reduce((sum, item) => sum + Number(item.paid_count || 0), 0));
const nodeStatus = computed(() => Number(stats.value.onlineNodes || 0) > 0 ? '运行正常' : '暂无在线节点');

function range() {
  const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 13);
  const fmt = value => value.toISOString().slice(0, 10);
  return `start_date=${fmt(start)}&end_date=${fmt(end)}`;
}
async function load() {
  refreshing.value = true; error.value = '';
  try {
    const [overview, orderData] = await Promise.all([get('/stat/getStats'), get(`/stat/getOrder?${range()}`)]);
    stats.value = overview || {};
    orders.value = orderData?.list || [];
    updatedAt.value = new Date();
  } catch (e) { error.value = e.message || '仪表盘数据加载失败'; }
  finally { loading.value = false; refreshing.value = false; }
}
onMounted(load);
</script>

<template>
  <section class="page-stack dashboard-page">
    <div class="dashboard-hero">
      <div>
        <span class="dashboard-date">{{ dateText() }}</span>
        <h1>经营仪表盘</h1>
        <p>收入、用户与服务运行状态一屏掌握。</p>
      </div>
      <div class="dashboard-hero-actions">
        <span v-if="updatedAt">更新于 {{ updatedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</span>
        <button class="btn btn-ghost" :disabled="refreshing" @click="load"><AppIcon name="RefreshCw" :size="15" />{{ refreshing ? '更新中…' : '刷新数据' }}</button>
      </div>
    </div>

    <div v-if="error" class="alert alert-error dashboard-error"><span>{{ error }}</span><button @click="load">重新加载</button></div>

    <div class="dashboard-kpis">
      <article class="dashboard-kpi income"><div class="dashboard-kpi-icon"><AppIcon name="WalletCards" :size="21" /></div><div><span>今日收入</span><strong>{{ loading ? '—' : money(stats.todayIncome) }}</strong><small :class="growthClass(stats.dayIncomeGrowth)">{{ growth(stats.dayIncomeGrowth) }} 较昨日</small></div></article>
      <article class="dashboard-kpi month"><div class="dashboard-kpi-icon"><AppIcon name="ChartNoAxesCombined" :size="21" /></div><div><span>本月收入</span><strong>{{ loading ? '—' : money(stats.currentMonthIncome) }}</strong><small :class="growthClass(stats.monthIncomeGrowth)">{{ growth(stats.monthIncomeGrowth) }} 较上月</small></div></article>
      <article class="dashboard-kpi users"><div class="dashboard-kpi-icon"><AppIcon name="Users" :size="21" /></div><div><span>有效用户</span><strong>{{ loading ? '—' : number(stats.activeUsers) }}</strong><small>总用户 {{ number(stats.totalUsers) }} · 本月 +{{ number(stats.currentMonthNewUsers) }}</small></div></article>
      <article class="dashboard-kpi traffic"><div class="dashboard-kpi-icon"><AppIcon name="Activity" :size="21" /></div><div><span>今日流量</span><strong>{{ loading ? '—' : traffic(stats.todayTraffic?.total) }}</strong><small>本月 {{ traffic(stats.monthTraffic?.total) }}</small></div></article>
    </div>

    <div class="dashboard-main-grid">
      <section class="panel dashboard-chart-panel">
        <div class="panel-head"><div><span class="eyebrow">REVENUE TREND</span><h2>近 14 天收入趋势</h2><p>已支付订单的每日收入与成交笔数。</p></div><div class="dashboard-chart-summary"><span>累计收入<strong>{{ money(total14) }}</strong></span><span>成交订单<strong>{{ number(count14) }}</strong></span></div></div>
        <div v-if="loading" class="dashboard-skeleton chart"></div>
        <div v-else-if="orders.length" class="dashboard-chart">
          <svg viewBox="0 0 620 200" preserveAspectRatio="none" aria-label="收入趋势图"><defs><linearGradient id="dashboardArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366f1" stop-opacity=".32"/><stop offset="100%" stop-color="#6366f1" stop-opacity="0"/></linearGradient></defs><line v-for="y in [30,80,130,180]" :key="y" x1="0" :y1="y" x2="620" :y2="y" class="chart-grid-line"/><polygon :points="`0,180 ${chartPoints} 620,180`" fill="url(#dashboardArea)"/><polyline :points="chartPoints" class="chart-line"/></svg>
          <div class="dashboard-chart-labels"><span v-for="(item,index) in orders" :key="item.date" v-show="index===0 || index===orders.length-1 || index===Math.floor(orders.length/2)">{{ item.date.slice(5) }}</span></div>
        </div>
        <div v-else class="settings-loading">近 14 天暂无订单统计</div>
      </section>

      <section class="panel dashboard-tasks">
        <div class="panel-head"><div><span class="eyebrow">TO DO</span><h2>待办事项</h2><p>优先处理影响用户体验的事项。</p></div></div>
        <RouterLink to="/user/ticket"><span class="task-icon urgent"><AppIcon name="Ticket" :size="18" /></span><div><strong>待处理工单</strong><small>及时回复用户咨询与故障反馈</small></div><b>{{ number(stats.ticketPendingTotal) }}</b><AppIcon name="ChevronRight" :size="17" /></RouterLink>
        <RouterLink to="/subscription/order"><span class="task-icon"><AppIcon name="BadgeDollarSign" :size="18" /></span><div><strong>待结算佣金</strong><small>核对已完成订单的邀请佣金</small></div><b>{{ number(stats.commissionPendingTotal) }}</b><AppIcon name="ChevronRight" :size="17" /></RouterLink>
        <RouterLink to="/node/diagnostic"><span class="task-icon node"><AppIcon name="Server" :size="18" /></span><div><strong>节点运行检查</strong><small>{{ nodeStatus }}</small></div><b>{{ number(stats.onlineNodes) }}</b><AppIcon name="ChevronRight" :size="17" /></RouterLink>
      </section>
    </div>

    <div class="dashboard-bottom-grid">
      <section class="panel dashboard-runtime"><div class="panel-head"><div><span class="eyebrow">REALTIME</span><h2>实时运行</h2></div><span class="live-badge"><i></i>10 分钟内</span></div><div class="runtime-grid"><div><AppIcon name="Radio" :size="17" /><span>在线用户<strong>{{ number(stats.onlineUsers) }}</strong></span></div><div><AppIcon name="MonitorSmartphone" :size="17" /><span>在线设备<strong>{{ number(stats.onlineDevices) }}</strong></span></div><div><AppIcon name="Network" :size="17" /><span>在线节点<strong>{{ number(stats.onlineNodes) }}</strong></span></div><div><AppIcon name="Database" :size="17" /><span>累计流量<strong>{{ traffic(stats.totalTraffic?.total) }}</strong></span></div></div></section>
      <section class="panel dashboard-traffic-split"><div class="panel-head"><div><span class="eyebrow">TRAFFIC</span><h2>本月流量构成</h2></div><strong>{{ traffic(stats.monthTraffic?.total) }}</strong></div><div class="traffic-bar"><i :style="{width:`${Number(stats.monthTraffic?.total) ? Number(stats.monthTraffic?.download || 0) / Number(stats.monthTraffic.total) * 100 : 0}%`}"></i></div><div class="traffic-legend"><span><i class="download"></i>下载<strong>{{ traffic(stats.monthTraffic?.download) }}</strong></span><span><i class="upload"></i>上传<strong>{{ traffic(stats.monthTraffic?.upload) }}</strong></span></div></section>
    </div>
  </section>
</template>
