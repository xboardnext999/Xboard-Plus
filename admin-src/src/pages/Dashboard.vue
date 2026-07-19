<script setup>
import { onMounted, ref } from 'vue';
import { get } from '../services/http';
const stats = ref({});
const loading = ref(true);
const error = ref('');
const money = (value) => `¥${(Number(value || 0) / 100).toFixed(2)}`;
const traffic = (value) => {
  let n = Number(value || 0); const units = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
};
onMounted(async () => { try { stats.value = await get('/stat/getOverride'); } catch (e) { error.value = e.message; } finally { loading.value = false; } });
</script>

<template>
  <section class="page-stack">
    <div class="page-heading">
      <h1>仪表盘</h1>
      <p>实时查看收入、用户、节点和流量概览。</p>
    </div>

    <div class="stat-grid">
      <article class="stat-card">
        <span>今日收入</span>
        <strong>{{ loading ? '—' : money(stats.day_income) }}</strong>
      </article>
      <article class="stat-card">
        <span>本月注册用户</span>
        <strong>{{ loading ? '—' : stats.month_register_total || 0 }}</strong>
      </article>
      <article class="stat-card">
        <span>在线节点</span>
        <strong>{{ loading ? '—' : stats.online_nodes || 0 }}</strong>
      </article>
      <article class="stat-card">
        <span>待处理工单</span>
        <strong>{{ loading ? '—' : stats.ticket_pending_total || 0 }}</strong>
      </article>
    </div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>流量概览</h2>
          <p v-if="error" class="alert alert-error">{{ error }}</p>
        </div>
      </div>
      <div class="metric-list"><div><span>今日流量</span><strong>{{ traffic(stats.today_traffic?.total) }}</strong></div><div><span>本月流量</span><strong>{{ traffic(stats.month_traffic?.total) }}</strong></div><div><span>累计流量</span><strong>{{ traffic(stats.total_traffic?.total) }}</strong></div><div><span>在线用户</span><strong>{{ stats.online_users || 0 }}</strong></div></div>
    </section>
  </section>
</template>
