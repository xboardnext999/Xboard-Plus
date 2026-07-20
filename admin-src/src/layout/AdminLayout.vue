<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AdminSidebar from '../components/AdminSidebar.vue';
import AdminTopbar from '../components/AdminTopbar.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import AdminGate from '../components/AdminGate.vue';
import { get, post } from '../services/http';

const route = useRoute();
const collapsed = ref(localStorage.getItem('admin_sidebar_collapsed') === '1');
const mobileOpen = ref(false);
const lockReady = ref(false), lockEnabled = ref(false), lockScope = ref('full');
function toggleSidebar() {
  if (window.innerWidth <= 760) mobileOpen.value = !mobileOpen.value;
  else { collapsed.value = !collapsed.value; localStorage.setItem('admin_sidebar_collapsed', collapsed.value ? '1' : '0'); }
}
watch(() => route.fullPath, () => { mobileOpen.value = false; });
async function loadLock() { try { const data = await get('/admin-lock/status'); lockEnabled.value = Boolean(data.enabled); lockScope.value = data.scope || 'locked'; } catch { lockEnabled.value = false; lockScope.value = 'full'; } finally { lockReady.value = true; } }
async function lockNow() { await post('/admin-lock/lock'); lockScope.value = 'locked'; }
function handleLocked(event) { lockEnabled.value = true; lockScope.value = event.detail || 'locked'; }
onMounted(() => { window.addEventListener('admin:locked', handleLocked); loadLock(); });
onBeforeUnmount(() => window.removeEventListener('admin:locked', handleLocked));
</script>

<template>
  <div v-if="lockReady" class="admin-shell" :class="{ 'sidebar-collapsed': collapsed, 'mobile-nav-open': mobileOpen, 'gate-active': lockEnabled && lockScope !== 'full' }">
    <AdminSidebar v-if="!lockEnabled || lockScope === 'full'" :collapsed="collapsed" @close="mobileOpen = false" />
    <button v-if="mobileOpen" class="sidebar-scrim" aria-label="关闭菜单" @click="mobileOpen = false"></button>
    <main class="admin-main">
      <AdminTopbar v-if="!lockEnabled || lockScope === 'full'" @toggle-sidebar="toggleSidebar" @lock="lockNow" />
      <AdminGate v-if="lockEnabled && lockScope !== 'full'" :scope="lockScope" @scope="lockScope = $event" />
      <RouterView v-else />
    </main>
    <ConfirmDialog />
  </div>
</template>
