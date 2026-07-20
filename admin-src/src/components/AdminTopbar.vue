<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppIcon from './AppIcon.vue';
import { titleByPath } from '../config/menu';
import { flatMenus } from '../config/menu';

const emit = defineEmits(['toggle-sidebar', 'lock']);

const route = useRoute();
const router = useRouter();
const isDark = ref(document.documentElement.classList.contains('dark'));
const search = ref('');
const searchOpen = ref(false);
const results = computed(() => { const term = search.value.trim().toLowerCase(); return term ? flatMenus.filter((item) => `${item.title} ${item.group}`.toLowerCase().includes(term)).slice(0, 8) : []; });

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
function go(item) { search.value = ''; searchOpen.value = false; router.push(item.path); }
</script>

<template>
  <header class="admin-topbar">
    <div class="page-title">
      <button class="icon-button menu-button" type="button" title="展开/收起" @click="emit('toggle-sidebar')">
        <span class="menu-lines"></span>
      </button>
      <strong>{{ title }}</strong>
    </div>

    <div class="topbar-actions">
      <label class="search-box" @focusin="searchOpen = true" @focusout="setTimeout(() => { searchOpen = false; }, 150)">
        <AppIcon name="Search" :size="16" />
        <input v-model="search" placeholder="搜索菜单和功能..." @keydown.enter.prevent="results[0] && go(results[0])" @keydown.esc="search = ''; searchOpen = false" />
        <div v-if="searchOpen && search" class="menu-search-results"><button v-for="item in results" :key="item.path" type="button" @mousedown.prevent="go(item)"><AppIcon :name="item.icon" :size="16"/><span><strong>{{ item.title }}</strong><small>{{ item.group || '首页' }}</small></span></button><p v-if="!results.length">没有找到相关功能</p></div>
      </label>
      <button class="icon-button" type="button" :title="isDark ? '白天模式' : '暗黑模式'" @click="toggleTheme">
        <AppIcon :name="isDark ? 'Sun' : 'Moon'" :size="18" />
      </button>
      <button class="icon-button" type="button" title="立即锁定后台" @click="emit('lock')"><AppIcon name="Lock" :size="17" /></button>
      <button class="profile-button" type="button" title="退出登录" @click="logout">
        <span class="avatar">A</span>
        <span>admin</span>
        <AppIcon name="LogOut" :size="15" />
      </button>
    </div>
  </header>
</template>
