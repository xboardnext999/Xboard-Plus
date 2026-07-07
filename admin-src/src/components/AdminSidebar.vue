<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { menuGroups } from '../config/menu';
import AppIcon from './AppIcon.vue';

const route = useRoute();

const activePath = computed(() => `/${route.path.replace(/^\/+/, '')}`);
</script>

<template>
  <aside class="admin-sidebar">
    <RouterLink class="brand" to="/dashboard">
      <span class="brand-mark">X</span>
      <span>Xboard Plus</span>
    </RouterLink>

    <nav class="sidebar-nav">
      <section v-for="group in menuGroups" :key="group.title || 'root'" class="nav-group">
        <h3 v-if="group.title">{{ group.title }}</h3>
        <RouterLink
          v-for="item in group.items"
          :key="item.path"
          class="nav-item"
          :class="{ active: activePath === item.path }"
          :to="item.path"
        >
          <AppIcon :name="item.icon" :size="18" />
          <span>{{ item.title }}</span>
        </RouterLink>
      </section>
    </nav>
  </aside>
</template>
