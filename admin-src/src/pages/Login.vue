<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { appBaseUrl } from '../services/http';

const router = useRouter();
const title = window.settings?.title || 'Xboard Plus';
const form = reactive({ email: '', password: '' });
const loading = ref(false);
const error = ref('');

async function login() {
  loading.value = true; error.value = '';
  try {
    const response = await fetch(`${appBaseUrl()}/api/v2/passport/auth/login`, {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await response.json();
    const data = json.data || json;
    if (!response.ok || json.status === 'fail') throw new Error(json.message || '登录失败');
    if (!data.is_admin) throw new Error('该账号不是管理员');
    localStorage.setItem('XBOARD_ACCESS_TOKEN', data.auth_data);
    await router.replace('/dashboard');
  } catch (e) { error.value = e.message; }
  finally { loading.value = false; }
}
</script>

<template>
  <main class="login-page"><section class="login-card"><div class="login-brand"><span class="brand-mark">X</span><div><h1>{{ title }}</h1><p>管理后台</p></div></div><form @submit.prevent="login"><label class="field"><span>管理员邮箱</span><input v-model.trim="form.email" type="email" autocomplete="username" required /></label><label class="field"><span>密码</span><input v-model="form.password" type="password" minlength="8" autocomplete="current-password" required /></label><p v-if="error" class="alert alert-error">{{ error }}</p><button class="btn btn-primary login-submit" :disabled="loading">{{ loading ? '登录中…' : '登录' }}</button></form></section></main>
</template>
