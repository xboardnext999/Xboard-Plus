<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import AppIcon from '../components/AppIcon.vue';
import { get } from '../services/http';

const stats = ref({});
const orders = ref([]);
const nodeRank = ref([]);
const userRank = ref([]);
const queue = ref({});
const workload = ref([]);
const failedJobs = ref([]);
const selectedJob = ref(null);
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
const rankMax = items => Math.max(...items.map(item => Number(item.value || 0)), 1);
const queueWait = computed(() => {
  const values = Object.values(queue.value.wait || {}); return values.length ? Math.max(...values.map(Number)) : 0;
});
const queueState = computed(() => queue.value.status ? '运行中' : '未运行');
const queueMetric = value => value === null || value === undefined ? '不适用' : number(value);
const queueWaitText = computed(() => queue.value.waitUnit === 'jobs' ? `${number(queueWait.value)} 个任务` : queueWait.value > 0 ? `${queueWait.value.toFixed(1)} 秒` : '无等待');
const jobName = job => job?.name || job?.payload?.displayName || job?.payload?.job || '未知作业';
const jobTime = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
const jobException = job => String(job?.exception || job?.payload?.exception || '暂无异常详情');
const jobPayload = job => {
  const value = job?.payload || {}; try { return JSON.stringify(value, null, 2); } catch { return String(value); }
};
const queueMeta = {
  default: ['通用任务', '未指定专属队列的后台任务'], order_handle: ['订单处理', '开通订单与超时取消'],
  traffic_fetch: ['流量采集', '采集节点上报的用户流量'], stat: ['统计入库', '记录用户与节点流量统计'],
  user_alive_sync: ['在线同步', '同步用户在线状态'], send_email: ['邮件通知', '验证码、提醒与工单邮件'],
  send_email_mass: ['群发邮件', '批量用户邮件通知'], send_telegram: ['Telegram', '机器人消息通知'],
  node_sync: ['节点同步', '同步用户权限与节点配置'],
};
const queueInfo = name => queueMeta[name] || [name, '后台异步任务'];

function range() {
  const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 13);
  const fmt = value => value.toISOString().slice(0, 10);
  return `start_date=${fmt(start)}&end_date=${fmt(end)}`;
}
async function load() {
  refreshing.value = true; error.value = '';
  try {
    const [overview, orderData, nodes, users, queueStats, queueWorkload, jobs] = await Promise.all([
      get('/stat/getStats'), get(`/stat/getOrder?${range()}`),
      get('/stat/getTrafficRank?type=node'), get('/stat/getTrafficRank?type=user'),
      get('/system/getQueueStats'), get('/system/getQueueWorkload'),
      get('/system/getHorizonFailedJobs?current=1&page_size=10'),
    ]);
    stats.value = overview || {};
    orders.value = orderData?.list || [];
    nodeRank.value = nodes || []; userRank.value = users || [];
    queue.value = queueStats || {}; workload.value = queueWorkload || []; failedJobs.value = jobs || [];
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

    <div class="dashboard-ops-grid">
      <div class="dashboard-rank-pair">
        <section class="panel dashboard-ranking">
          <div class="panel-head"><div><span class="eyebrow">NODE TRAFFIC</span><h2>节点流量排行</h2><p>近 7 天高负载节点。</p></div><RouterLink to="/node/list" class="ranking-link">节点管理 <AppIcon name="ChevronRight" :size="14" /></RouterLink></div>
          <div v-if="loading" class="dashboard-skeleton ranking"></div>
          <div v-else-if="nodeRank.length" class="ranking-list"><div v-for="(item,index) in nodeRank" :key="`node-${item.id}`"><b :class="{top:index<3}">{{ index + 1 }}</b><div class="ranking-name"><strong>{{ item.name }}</strong><small>#{{ item.id }}</small><i><em :style="{width:`${Number(item.value||0)/rankMax(nodeRank)*100}%`}"></em></i></div><div class="ranking-value"><strong>{{ traffic(item.value) }}</strong><small :class="growthClass(item.change)">{{ growth(item.change) }}</small></div></div></div>
          <div v-else class="settings-loading">近 7 天暂无节点流量记录</div>
        </section>
        <section class="panel dashboard-ranking user-ranking">
          <div class="panel-head"><div><span class="eyebrow">USER TRAFFIC</span><h2>用户流量排行</h2><p>近 7 天高用量用户。</p></div><RouterLink to="/user/list" class="ranking-link">用户管理 <AppIcon name="ChevronRight" :size="14" /></RouterLink></div>
          <div v-if="loading" class="dashboard-skeleton ranking"></div>
          <div v-else-if="userRank.length" class="ranking-list"><div v-for="(item,index) in userRank" :key="`user-${item.id}`"><b :class="{top:index<3}">{{ index + 1 }}</b><div class="ranking-name"><strong>{{ item.name }}</strong><small>#{{ item.id }}</small><i><em :style="{width:`${Number(item.value||0)/rankMax(userRank)*100}%`}"></em></i></div><div class="ranking-value"><strong>{{ traffic(item.value) }}</strong><small :class="growthClass(item.change)">{{ growth(item.change) }}</small></div></div></div>
          <div v-else class="settings-loading">近 7 天暂无用户流量记录</div>
        </section>
      </div>

    </div>

    <div class="dashboard-queue-jobs-grid">
      <section class="panel dashboard-queue">
        <div class="panel-head"><div><span class="eyebrow">QUEUE HEALTH</span><h2>队列状态</h2><p>{{ queue.modeLabel || '任务队列' }} · 实时进程与积压情况。</p></div><span class="queue-state" :class="{off:!queue.status}"><i></i>{{ queueState }}</span></div>
        <div v-if="queue.mode==='worker'" class="queue-mode-note"><AppIcon name="Info" :size="15" /><span>当前使用普通 Redis Worker；已完成作业不会保留历史，吞吐指标仅 Horizon 模式支持。</span></div>
        <div v-if="queue.mode==='worker'" class="queue-metrics"><div><span>工作进程</span><strong>{{ number(queue.processes) }}</strong></div><div><span>待处理</span><strong>{{ number(queue.readyJobs) }}</strong></div><div><span>执行中</span><strong>{{ number(queue.reservedJobs) }}</strong></div><div><span>延迟任务</span><strong>{{ number(queue.delayedJobs) }}</strong></div></div>
        <div v-else class="queue-metrics"><div><span>工作进程</span><strong>{{ number(queue.processes) }}</strong></div><div><span>每分钟作业</span><strong>{{ queueMetric(queue.jobsPerMinute) }}</strong></div><div><span>近期作业</span><strong>{{ queueMetric(queue.recentJobs) }}</strong></div><div :class="{danger:Number(queue.failedJobs)>0}"><span>失败作业</span><strong>{{ number(queue.failedJobs) }}</strong></div></div>
        <div class="queue-highlight"><div><span>{{ queue.waitUnit==='jobs'?'最大队列积压':'最大等待' }}</span><strong>{{ queueWaitText }}</strong></div><div><span>{{ queue.mode==='worker'?'累计失败作业':'暂停主进程' }}</span><strong>{{ queue.mode==='worker'?number(queue.failedJobs):queueMetric(queue.pausedMasters) }}</strong></div></div>
        <div class="workload-list"><div class="workload-title"><strong>业务队列</strong><span>{{ workload.length }} 个队列共享 {{ number(queue.processes) }} 个 Worker</span></div><div v-if="workload.length" class="queue-business-grid"><article v-for="item in workload" :key="item.name" :class="{busy:Number(item.length)+Number(item.reserved)+Number(item.delayed)>0}"><div><strong>{{ queueInfo(item.name)[0] }}</strong><code>{{ item.name }}</code></div><p>{{ queueInfo(item.name)[1] }}</p><span><b>{{ number(item.length) }}</b> 等待</span><span><b>{{ number(item.reserved) }}</b> 执行</span><span><b>{{ number(item.delayed) }}</b> 延迟</span></article></div><div v-else class="queue-empty">暂无队列负载数据</div></div>
      </section>
      <section class="panel dashboard-jobs">
      <div class="panel-head"><div><span class="eyebrow">JOB DETAILS</span><h2>作业详情</h2><p>失败作业会持久保存；点击可查看完整负载与错误信息。</p></div><span class="job-count">{{ failedJobs.length }} 条最近记录</span></div>
      <div v-if="loading" class="dashboard-skeleton jobs"></div>
      <div v-else-if="failedJobs.length" class="job-table"><div class="job-table-head"><span>作业</span><span>连接 / 队列</span><span>失败时间</span><span>异常摘要</span><span></span></div><button v-for="job in failedJobs" :key="job.id" @click="selectedJob=job"><span><strong>{{ jobName(job) }}</strong><small>{{ job.id }}</small></span><span><strong>{{ job.connection || 'redis' }}</strong><small>{{ job.queue || 'default' }}</small></span><span>{{ jobTime(job.failed_at) }}</span><span class="job-error">{{ jobException(job).split('\n')[0] }}</span><AppIcon name="ChevronRight" :size="17" /></button></div>
      <div v-else class="job-empty-dashboard"><div class="job-success"><span class="job-success-icon"><AppIcon name="CircleCheckBig" :size="24" /></span><div><strong>队列运行正常</strong><span>当前没有失败或需要人工介入的作业。</span></div></div><div class="job-empty-metrics"><span>运行模式<strong>{{ queue.modeLabel || '任务队列' }}</strong></span><span>失败记录<strong>{{ number(queue.failedJobs) }} 条</strong></span><span>成功作业<strong>完成即释放</strong></span><span>异常记录<strong>持久保存</strong></span></div><div class="job-scope"><strong>当前 Worker主要处理</strong><div><span>订单开通</span><span>流量采集</span><span>统计入库</span><span>节点同步</span><span>邮件通知</span><span>Telegram</span></div><p><AppIcon name="Info" :size="14" />普通 Worker不保存成功作业历史；作业详情用于定位失败任务及异常负载。</p></div></div>
      </section>
    </div>

    <div v-if="selectedJob" class="modal-backdrop" @click.self="selectedJob=null"><section class="modal-card dashboard-job-detail"><div class="panel-head"><div><span class="eyebrow">FAILED JOB</span><h2>{{ jobName(selectedJob) }}</h2><p>{{ selectedJob.connection || 'redis' }} / {{ selectedJob.queue || 'default' }} · {{ jobTime(selectedJob.failed_at) }}</p></div><button class="btn btn-ghost" @click="selectedJob=null">关闭</button></div><div class="job-detail-meta"><span>作业 ID<strong>{{ selectedJob.id || '—' }}</strong></span><span>状态<strong>{{ selectedJob.status || '失败' }}</strong></span><span>连接<strong>{{ selectedJob.connection || 'redis' }}</strong></span><span>队列<strong>{{ selectedJob.queue || 'default' }}</strong></span></div><h3>异常信息</h3><pre class="job-exception">{{ jobException(selectedJob) }}</pre><h3>作业负载</h3><pre class="job-payload">{{ jobPayload(selectedJob) }}</pre></section></div>
  </section>
</template>
