<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppIcon from './AppIcon.vue';
import { titleByPath } from '../config/menu';

const route = useRoute();
const router = useRouter();
const isDark = ref(document.documentElement.classList.contains('dark'));

const title = computed(() => route.meta.title || titleByPath(`/${route.path}`));

function toggleTheme() {
  isDark.value = !isDark.value;
  document.documentElement.classList.toggle('dark', isDark.value);
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
}

function logout() {
  ['XBOARD_ACCESS_TOKEN', 'token', 'access_token'].forEach((key) => localStorage.removeItem(key));
  router.replace({ name: 'Login' });
}
</script>

<template>
  <header class="admin-topbar">
    <div class="page-title">
      <button class="icon-button menu-button" type="button" title="展开/收起">
        <span class="menu-lines"></span>
      </button>
      <strong>{{ title }}</strong>
    </div>

    <div class="topbar-actions">
      <label class="search-box">
        <AppIcon name="Search" :size="16" />
        <input placeholder="搜索菜单和功能..." />
      </label>
      <button class="icon-button" type="button" :title="isDark ? '白天模式' : '暗黑模式'" @click="toggleTheme">
        <AppIcon :name="isDark ? 'Sun' : 'Moon'" :size="18" />
      </button>
      <button class="profile-button" type="button" title="退出登录" @click="logout">
        <span class="avatar">A</span>
        <span>admin</span>
        <AppIcon name="LogOut" :size="15" />
      </button>
    </div>
  </header>
</template>
