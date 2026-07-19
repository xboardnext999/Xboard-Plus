<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import { adminApi, authToken, get, post } from '../services/http';

const LEVELS = { 0: ['低', ''], 1: ['中', 'waiting'], 2: ['高', 'danger'] };
const tickets = ref([]), loading = ref(false), busy = ref(null), selected = ref(null), showConversation = ref(false), replying = ref(false);
const filters = reactive({ keyword: '', status: 'all', reply_status: 'all', level: 'all' });
const page = reactive({ current: 1, size: 20, total: 0, last: 1 });
const toast = reactive({ text: '', type: 'success' });
const replyText = ref('');
const stats = computed(() => ({ page: tickets.value.length, waiting: tickets.value.filter(t => Number(t.status) === 0 && Number(t.reply_status) === 0).length, replied: tickets.value.filter(t => Number(t.reply_status) === 1).length, closed: tickets.value.filter(t => Number(t.status) === 1).length }));

function notify(text, type = 'success') { toast.text = text; toast.type = type; clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.text = '', 2800); }
function time(v) { return v ? new Date(Number(v) * 1000).toLocaleString('zh-CN', { hour12: false }) : '-'; }
function level(t) { return LEVELS[Number(t.level)] || ['未知', 'off']; }
function query() { const q = new URLSearchParams({ current: String(page.current), pageSize: String(page.size) }); if (filters.status !== 'all') q.set('status', filters.status); if (filters.reply_status !== 'all') q.append('reply_status[]', filters.reply_status); if (filters.keyword.includes('@')) q.set('email', filters.keyword.trim()); else if (filters.keyword) { q.set('filter[0][id]', /^\d+$/.test(filters.keyword) ? 'id' : 'subject'); q.set('filter[0][value]', filters.keyword); } if (filters.level !== 'all') { const i = filters.keyword && !filters.keyword.includes('@') ? 1 : 0; q.set(`filter[${i}][id]`, 'level'); q.set(`filter[${i}][value]`, filters.level); } return q.toString(); }
async function fetchRaw(path) { const response = await fetch(adminApi(path), { headers: { Accept: 'application/json', Authorization: `Bearer ${authToken().replace(/^Bearer /, '')}` } }); const json = await response.json().catch(() => ({})); if (!response.ok || json.status === 'fail' || (json.code && Number(json.code) !== 0)) throw new Error(json.message || '请求失败'); return json; }
async function load(reset = false) { if (reset) page.current = 1; loading.value = true; try { const json = await fetchRaw(`/ticket/fetch?${query()}`); tickets.value = Array.isArray(json.data) ? json.data : []; page.total = Number(json.total || tickets.value.length); page.last = Math.max(1, Math.ceil(page.total / page.size)); } catch (e) { notify(e.message, 'error'); } finally { loading.value = false; } }
async function openTicket(ticket) { busy.value = ticket.id; try { selected.value = await get('/ticket/fetch', { id: ticket.id }); replyText.value = ''; showConversation.value = true; } catch (e) { notify(e.message, 'error'); } finally { busy.value = null; } }
async function reply() { const message = replyText.value.trim(); if (!message) return notify('请输入回复内容', 'error'); if (message.length > 10000) return notify('回复内容不能超过 10,000 字', 'error'); replying.value = true; try { await post('/ticket/reply', { id: selected.value.id, message }); notify('回复已发送，邮件通知已加入队列'); replyText.value = ''; selected.value = await get('/ticket/fetch', { id: selected.value.id }); await load(); } catch (e) { notify(e.message, 'error'); } finally { replying.value = false; } }
async function closeTicket(ticket = selected.value) { if (!confirm(`确定关闭工单 #${ticket.id}「${ticket.subject}」？关闭后用户不能继续回复。`)) return; busy.value = ticket.id; try { await post('/ticket/close', { id: ticket.id }); notify('工单已关闭'); if (selected.value?.id === ticket.id) { selected.value.status = 1; showConversation.value = false; } await load(); } catch (e) { notify(e.message, 'error'); } finally { busy.value = null; } }
async function copy(value, label) { await navigator.clipboard.writeText(value || ''); notify(`${label}已复制`); }
onMounted(() => load(true));
</script>

<template>
  <section class="page-stack">
    <div class="page-heading page-heading-row"><div><h1>工单管理</h1><p>处理用户咨询、跟踪待回复工单，并查看完整沟通记录。</p></div><button class="btn btn-ghost" :disabled="loading" @click="load()"><AppIcon name="RefreshCw" :size="16" />刷新工单</button></div>
    <div class="stat-grid ticket-stats"><article class="stat-card"><span>当前页工单</span><strong>{{ stats.page }}</strong></article><article class="stat-card"><span>等待回复</span><strong>{{ stats.waiting }}</strong></article><article class="stat-card"><span>已回复</span><strong>{{ stats.replied }}</strong></article><article class="stat-card"><span>已关闭</span><strong>{{ stats.closed }}</strong></article></div>
    <div class="ticket-toolbar">
      <label class="filter-input"><span>搜索</span><input v-model.trim="filters.keyword" placeholder="工单主题、ID 或完整用户邮箱" @keyup.enter="load(true)" /></label>
      <label class="field compact-field"><span>工单状态</span><select v-model="filters.status" @change="load(true)"><option value="all">全部状态</option><option value="0">处理中</option><option value="1">已关闭</option></select></label>
      <label class="field compact-field"><span>回复状态</span><select v-model="filters.reply_status" @change="load(true)"><option value="all">全部回复状态</option><option value="0">等待管理员</option><option value="1">管理员已回复</option></select></label>
      <label class="field compact-field"><span>优先级</span><select v-model="filters.level" @change="load(true)"><option value="all">全部优先级</option><option value="0">低</option><option value="1">中</option><option value="2">高</option></select></label>
      <button class="btn btn-ghost" @click="load(true)">查询</button>
    </div>
    <div v-if="loading" class="panel settings-loading">正在加载工单…</div><div v-else-if="!tickets.length" class="panel settings-loading">暂无符合条件的工单</div>
    <div v-else class="ticket-list">
      <article v-for="t in tickets" :key="t.id" class="panel ticket-card" :class="{ urgent: Number(t.level) === 2 && Number(t.status) === 0 }">
        <button class="ticket-main" @click="openTicket(t)"><span class="ticket-level" :class="level(t)[1]">{{ level(t)[0] }}</span><div><h2>{{ t.subject }}</h2><p>{{ t.user?.email || `用户 #${t.user_id}` }} · 工单 #{{ t.id }}</p></div></button>
        <div class="ticket-state"><span class="status-pill" :class="{ off: Number(t.status) === 1, waiting: Number(t.status) === 0 && Number(t.reply_status) === 0 }">{{ Number(t.status) === 1 ? '已关闭' : Number(t.reply_status) === 0 ? '等待回复' : '已回复' }}</span><small>更新 {{ time(t.updated_at) }}</small></div>
        <div class="ticket-actions"><button class="btn btn-primary btn-sm" :disabled="busy === t.id" @click="openTicket(t)">{{ Number(t.status) === 0 ? '查看并回复' : '查看记录' }}</button><button v-if="Number(t.status) === 0" class="btn btn-ghost btn-sm" :disabled="busy === t.id" @click="closeTicket(t)">关闭工单</button></div>
      </article>
    </div>
    <div class="pagination"><span>共 {{ page.total }} 条</span><button class="btn btn-ghost btn-sm" :disabled="page.current <= 1 || loading" @click="page.current--; load()">上一页</button><span>{{ page.current }} / {{ page.last }}</span><button class="btn btn-ghost btn-sm" :disabled="page.current >= page.last || loading" @click="page.current++; load()">下一页</button></div>
    <div v-if="showConversation && selected" class="modal-backdrop" @click.self="showConversation = false"><section class="modal-card ticket-conversation"><div class="panel-head"><div><h2>{{ selected.subject }}</h2><p>{{ selected.user?.email }} · 工单 #{{ selected.id }} · {{ level(selected)[0] }}优先级</p></div><button class="btn btn-ghost" @click="showConversation = false">关闭</button></div>
      <div class="ticket-user-summary"><span>用户<strong>{{ selected.user?.email }}</strong></span><span>套餐<strong>{{ selected.user?.plan?.name || `#${selected.user?.plan_id || '-'}` }}</strong></span><span>余额<strong>¥{{ Number(selected.user?.balance || 0).toFixed(2) }}</strong></span><button class="btn btn-ghost btn-sm" @click="copy(selected.user?.email, '邮箱')">复制邮箱</button></div>
      <div class="message-timeline"><div v-if="!selected.messages?.length" class="empty">暂无消息内容</div><article v-for="m in selected.messages" :key="m.id" :class="{ admin: m.is_from_admin }"><div><strong>{{ m.is_from_admin ? '管理员' : selected.user?.email }}</strong><small>{{ time(m.created_at) }}</small></div><p>{{ m.message }}</p></article></div>
      <div v-if="Number(selected.status) === 0" class="ticket-reply"><div class="reply-tools"><span>回复用户</span><small>{{ replyText.length }} / 10000</small></div><textarea v-model="replyText" rows="5" maxlength="10000" placeholder="输入回复内容；发送后系统会异步通知用户邮箱。" @keydown.ctrl.enter.prevent="reply" /><div class="modal-actions"><small>Ctrl + Enter 快速发送</small><button class="btn btn-ghost" @click="closeTicket(selected)">关闭工单</button><button class="btn btn-primary" :disabled="replying || !replyText.trim()" @click="reply">{{ replying ? '发送中…' : '发送回复' }}</button></div></div><div v-else class="ticket-closed-note">该工单已关闭，仅可查看历史消息。</div>
    </section></div><div v-if="toast.text" class="toast" :class="{ error: toast.type === 'error' }">{{ toast.text }}</div>
  </section>
</template>
