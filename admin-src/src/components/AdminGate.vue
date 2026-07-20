<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import { get, post } from '../services/http';
const props = defineProps({ scope: { type: String, default: 'locked' } });
const emit = defineEmits(['scope']);
const password = ref(''), busy = ref(false), error = ref(''), summary = reactive({});
async function unlock() { if (!password.value) return; busy.value = true; error.value = ''; try { const data = await post('/admin-lock/unlock', { password: password.value }); password.value = ''; emit('scope', data.scope); } catch (e) { error.value = e.message; } finally { busy.value = false; } }
async function lock() { await post('/admin-lock/lock'); emit('scope', 'locked'); }
async function loadSummary() { if (props.scope === 'simple') try { Object.assign(summary, await get('/admin-lock/summary')); } catch (e) { error.value = e.message; } }
onMounted(loadSummary);
watch(() => props.scope, loadSummary);
</script>
<template>
  <section v-if="scope === 'locked'" class="admin-lock-page"><div class="admin-lock-card"><div class="admin-lock-brand"><span><AppIcon name="LockKeyhole" :size="26" /></span><div><h1>后台已锁定</h1><p>请输入访问密码继续</p></div></div><form @submit.prevent="unlock"><label class="field"><span>访问密码</span><input v-model="password" type="password" autocomplete="current-password" autofocus placeholder="请输入简易密码或后台密码" /></label><p v-if="error" class="alert alert-error">{{ error }}</p><button class="btn btn-primary" :disabled="busy || !password">{{ busy ? '验证中…' : '解锁后台' }}</button></form><small>不同密码对应不同访问级别；连续输错将暂时限制尝试。</small></div></section>
  <section v-else class="simple-console page-stack"><div class="simple-head"><div><span class="eyebrow">SAFE VIEW</span><h1>服务概览</h1><p>当前为简易访问模式，仅展示非敏感运行信息。</p></div><div><button class="btn btn-ghost" @click="emit('scope','locked')">切换访问级别</button><button class="btn btn-ghost" @click="lock">立即上锁</button></div></div><div class="simple-metrics"><article class="panel"><AppIcon name="Activity" :size="20"/><span>服务状态<strong>{{ summary.service || '读取中…' }}</strong></span></article><article class="panel"><AppIcon name="UsersRound" :size="20"/><span>账户服务<strong>{{ summary.account || '—' }}</strong></span></article><article class="panel"><AppIcon name="CreditCard" :size="20"/><span>数据同步<strong>{{ summary.sync || '—' }}</strong></span></article></div><section class="panel simple-note"><AppIcon name="ShieldAlert" :size="22"/><div><h2>受限访问模式</h2><p>用户资料、订单金额、节点地址、系统配置及所有写操作均已由服务端拦截。需要管理系统时，请切换访问级别并输入完整后台密码。</p><small>数据更新时间：{{ summary.updated_at || '—' }}</small></div></section></section>
</template>
