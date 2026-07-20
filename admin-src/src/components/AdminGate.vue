<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import { get, post } from '../services/http';
const props = defineProps({ scope: { type: String, default: 'locked' } });
const emit = defineEmits(['scope']);
const password = ref(''), busy = ref(false), error = ref(''), summary = reactive({});
async function unlock() { if (!password.value) return; busy.value = true; error.value = ''; try { const data = await post('/admin-lock/unlock', { password: password.value }); password.value = ''; emit('scope', data.scope); } catch (e) { error.value = e.message; } finally { busy.value = false; } }
async function lock() { await post('/admin-lock/lock'); emit('scope', 'locked'); }
async function loadSummary() { if (props.scope === 'a') try { Object.assign(summary, await get('/admin-lock/summary')); } catch (e) { error.value = e.message; } }
onMounted(loadSummary);
watch(() => props.scope, loadSummary);
</script>
<template>
  <section v-if="scope === 'locked'" class="admin-lock-page"><div class="admin-lock-card"><div class="admin-lock-brand"><span><AppIcon name="LockKeyhole" :size="26" /></span><div><h1>访问验证</h1><p>请输入访问密码继续</p></div></div><form @submit.prevent="unlock"><label class="field"><span>访问密码</span><input v-model="password" type="password" autocomplete="current-password" autofocus placeholder="请输入访问密码" /></label><p v-if="error" class="alert alert-error">{{ error }}</p><button class="btn btn-primary" :disabled="busy || !password">{{ busy ? '验证中…' : '继续' }}</button></form><small>连续输错将暂时限制验证。</small></div></section>
  <section v-else class="simple-console page-stack"><div class="simple-head"><div><span class="eyebrow">SYSTEM STATUS</span><h1>系统状态</h1><p>服务运行状态与基础信息。</p></div><div><button class="btn btn-ghost" @click="emit('scope','locked')">重新验证</button><button class="btn btn-ghost" @click="lock">退出</button></div></div><div class="simple-metrics"><article class="panel"><AppIcon name="Activity" :size="20"/><span>服务状态<strong>{{ summary.service || '读取中…' }}</strong></span></article><article class="panel"><AppIcon name="UsersRound" :size="20"/><span>账户服务<strong>{{ summary.account || '—' }}</strong></span></article><article class="panel"><AppIcon name="CreditCard" :size="20"/><span>数据同步<strong>{{ summary.sync || '—' }}</strong></span></article></div><section class="panel simple-note"><AppIcon name="Activity" :size="22"/><div><h2>运行信息</h2><p>各项服务当前运行正常，无需进行额外操作。</p><small>数据更新时间：{{ summary.updated_at || '—' }}</small></div></section></section>
</template>
