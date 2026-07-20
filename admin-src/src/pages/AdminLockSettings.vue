<script setup>
import { onMounted, reactive, ref } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import { get, post } from '../services/http';

const loading = ref(true), saving = ref(false), reveal = ref(false);
const message = reactive({ text: '', type: 'success' });
const form = reactive({ enabled: true, ttl_minutes: 480, current_full_password: '', simple_password: '', simple_confirmation: '', full_password: '', full_confirmation: '' });
const state = reactive({ simple_password_set: false, full_password_set: false });
function notify(text, type = 'success') { message.text = text; message.type = type; clearTimeout(notify.timer); notify.timer = setTimeout(() => { message.text = ''; }, 3500); }
async function load() {
  loading.value = true;
  try { const data = await get('/admin-lock/settings'); Object.assign(form, { enabled: data.enabled, ttl_minutes: data.ttl_minutes }); Object.assign(state, data); }
  catch (error) { notify(error.message, 'error'); } finally { loading.value = false; }
}
async function save() {
  if (form.simple_password && form.simple_password !== form.simple_confirmation) return notify('两次输入的访问密码 A 不一致', 'error');
  if (form.full_password && form.full_password !== form.full_confirmation) return notify('两次输入的访问密码 B 不一致', 'error');
  if (form.simple_password && form.full_password && form.simple_password === form.full_password) return notify('两个访问密码不能相同', 'error');
  saving.value = true;
  try {
    const result = await post('/admin-lock/settings', { enabled: form.enabled, ttl_minutes: Number(form.ttl_minutes), current_full_password: form.current_full_password, simple_password: form.simple_password || null, full_password: form.full_password || null });
    form.current_full_password = ''; form.simple_password = ''; form.simple_confirmation = ''; form.full_password = ''; form.full_confirmation = '';
    notify(result.requires_unlock ? '设置已保存，请使用新密码重新解锁' : '后台访问锁已关闭');
    if (result.requires_unlock) setTimeout(() => window.dispatchEvent(new CustomEvent('admin:locked', { detail: 'locked' })), 900); else load();
  } catch (error) { notify(error.message, 'error'); } finally { saving.value = false; }
}
onMounted(load);
</script>

<template>
  <section class="page-stack lock-settings-page">
    <div class="page-heading"><span class="eyebrow">ACCESS CONTROL</span><h1>后台访问锁</h1><p>自定义二次访问密码，并控制解锁状态的有效时间。</p></div>
    <div v-if="loading" class="panel settings-loading">正在读取访问锁设置…</div>
    <template v-else>
      <section class="panel lock-status-card">
        <div class="lock-status-icon"><AppIcon name="LockKeyhole" :size="24" /></div>
        <div><h2>二次访问保护</h2><p>管理员登录成功后，仍需输入访问密码才能查看后台内容。</p></div>
        <ToggleSwitch v-model="form.enabled" on-label="保护已开启" off-label="保护已关闭" />
      </section>
      <div class="lock-settings-grid">
        <section class="panel lock-password-card">
          <div class="panel-head"><div><h2>访问密码 A</h2><p>用于日常状态验证。</p></div><span class="status-pill success">{{ state.simple_password_set ? '已设置' : '未设置' }}</span></div>
          <label class="field"><span>新密码</span><input v-model="form.simple_password" :type="reveal ? 'text' : 'password'" minlength="8" maxlength="128" autocomplete="new-password" placeholder="留空表示不修改" /><small>至少 8 位，不能与访问密码 B 相同。</small></label>
          <label class="field"><span>确认新密码</span><input v-model="form.simple_confirmation" :type="reveal ? 'text' : 'password'" autocomplete="new-password" placeholder="再次输入新密码" /></label>
        </section>
        <section class="panel lock-password-card critical">
          <div class="panel-head"><div><h2>访问密码 B</h2><p>用于管理操作验证。</p></div><span class="status-pill success">{{ state.full_password_set ? '已设置' : '未设置' }}</span></div>
          <label class="field"><span>新密码</span><input v-model="form.full_password" :type="reveal ? 'text' : 'password'" minlength="12" maxlength="128" autocomplete="new-password" placeholder="留空表示不修改" /><small>至少 12 位，建议使用随机密码。</small></label>
          <label class="field"><span>确认新密码</span><input v-model="form.full_confirmation" :type="reveal ? 'text' : 'password'" autocomplete="new-password" placeholder="再次输入新密码" /></label>
        </section>
      </div>
      <section class="panel lock-policy-card">
        <div class="panel-head"><div><h2>解锁策略</h2><p>密码变更后，所有管理员的现有解锁状态会立即失效。</p></div><button class="btn btn-ghost btn-sm" type="button" @click="reveal = !reveal">{{ reveal ? '隐藏密码' : '显示密码' }}</button></div>
        <div class="lock-policy-form">
          <label class="field"><span>解锁有效时间</span><select v-model.number="form.ttl_minutes"><option :value="30">30 分钟</option><option :value="60">1 小时</option><option :value="240">4 小时</option><option :value="480">8 小时</option><option :value="720">12 小时</option><option :value="1440">24 小时</option><option :value="10080">7 天</option></select></label>
          <label class="field"><span>当前访问密码 B *</span><input v-model="form.current_full_password" :type="reveal ? 'text' : 'password'" maxlength="128" autocomplete="current-password" placeholder="保存设置前必须验证" required /><small>用于确认本次设置修改。</small></label>
        </div>
        <div class="lock-security-note"><AppIcon name="ShieldAlert" :size="19" /><span>密码仅以不可逆哈希保存，页面和接口都不会返回密码原文。关闭访问锁同样需要验证当前完整密码。</span></div>
        <div class="modal-actions"><button class="btn btn-primary" :disabled="saving || !form.current_full_password" @click="save">{{ saving ? '保存中…' : '保存并应用' }}</button></div>
      </section>
    </template>
    <div v-if="message.text" class="toast" :class="{ error: message.type === 'error' }">{{ message.text }}</div>
  </section>
</template>
