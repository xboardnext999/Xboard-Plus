<script setup>
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AdminSidebar from '../components/AdminSidebar.vue';
import AdminTopbar from '../components/AdminTopbar.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';

const route = useRoute();
const collapsed = ref(localStorage.getItem('admin_sidebar_collapsed') === '1');
const mobileOpen = ref(false);
function toggleSidebar() {
  if (window.innerWidth <= 760) mobileOpen.value = !mobileOpen.value;
  else { collapsed.value = !collapsed.value; localStorage.setItem('admin_sidebar_collapsed', collapsed.value ? '1' : '0'); }
}
watch(() => route.fullPath, () => { mobileOpen.value = false; });
</script>

<template>
  <div class="admin-shell" :class="{ 'sidebar-collapsed': collapsed, 'mobile-nav-open': mobileOpen }">
    <AdminSidebar :collapsed="collapsed" @close="mobileOpen = false" />
    <button v-if="mobileOpen" class="sidebar-scrim" aria-label="关闭菜单" @click="mobileOpen = false"></button>
    <main class="admin-main">
      <AdminTopbar @toggle-sidebar="toggleSidebar" />
      <RouterView />
    </main>
    <ConfirmDialog />
  </div>
</template>
