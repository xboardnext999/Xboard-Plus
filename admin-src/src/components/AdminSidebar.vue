<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { menuGroups } from '../config/menu';
import AppIcon from './AppIcon.vue';
const props = defineProps({ collapsed: Boolean, accessPermissions: { type: Object, default: null } });
defineEmits(['close']);

const route = useRoute();

const activePath = computed(() => route.fullPath);
const visibleGroups = computed(() => menuGroups.map((group) => ({ ...group, items: group.items.filter((item) => !props.accessPermissions || props.accessPermissions[item.path.split('?')[0]]) })).filter((group) => group.items.length));
</script>

<template>
  <aside class="admin-sidebar" :class="{ collapsed }">
    <RouterLink class="brand" to="/dashboard">
      <span class="brand-mark">X</span>
      <span>Xboard Plus</span>
    </RouterLink>

    <nav class="sidebar-nav">
      <section v-for="group in visibleGroups" :key="group.title || 'root'" class="nav-group">
        <h3 v-if="group.title">{{ group.title }}</h3>
        <RouterLink
          v-for="item in group.items"
          :key="item.path"
          class="nav-item"
          :class="{ active: activePath === item.path }"
          :to="item.path"
        >
          <AppIcon :name="item.icon" :size="18" />
          <span>{{ item.title }}</span><em v-if="collapsed">{{ item.title }}</em>
        </RouterLink>
      </section>
    </nav>
  </aside>
</template>
