<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AdminSidebar from '../components/AdminSidebar.vue';
import AdminTopbar from '../components/AdminTopbar.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import AdminGate from '../components/AdminGate.vue';
import { get, post } from '../services/http';

const route = useRoute();
const router = useRouter();
const collapsed = ref(localStorage.getItem('admin_sidebar_collapsed') === '1');
const mobileOpen = ref(false);
const lockReady = ref(false), lockEnabled = ref(true), lockScope = ref('locked');
const accessPermissions = ref(null);
let idleTimer;
function toggleSidebar() {
  if (window.innerWidth <= 760) mobileOpen.value = !mobileOpen.value;
  else { collapsed.value = !collapsed.value; localStorage.setItem('admin_sidebar_collapsed', collapsed.value ? '1' : '0'); }
}
watch(() => route.fullPath, () => { mobileOpen.value = false; });
async function loadAccess() { try { const data = await get('/temporary-access/me'); accessPermissions.value = data.temporary ? (data.permissions || {}) : null; } catch { accessPermissions.value = {}; } }
async function loadLock() { try { const data = await get('/admin-lock/status'); lockEnabled.value = Boolean(data.enabled); lockScope.value = data.scope || 'locked'; if (!lockEnabled.value || lockScope.value === 'b') await loadAccess(); } catch { lockEnabled.value = true; lockScope.value = 'locked'; } finally { lockReady.value = true; resetIdleTimer(); } }
async function lockNow() { try { await post('/admin-lock/lock'); } finally { lockScope.value = 'locked'; } }
function handleLocked(event) { lockEnabled.value = true; lockScope.value = event.detail || 'locked'; }
function resetIdleTimer() { clearTimeout(idleTimer); if (lockEnabled.value && lockScope.value === 'b') idleTimer = setTimeout(lockNow, 30 * 60 * 1000); }
const activityEvents = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
const navigating = ref(false);
let removeBefore, removeAfter, removeError;
onMounted(() => {
  window.addEventListener('admin:locked', handleLocked);
  activityEvents.forEach((event) => window.addEventListener(event, resetIdleTimer, { passive: true }));
  removeBefore = router.beforeEach(() => { navigating.value = true; });
  removeAfter = router.afterEach(() => { navigating.value = false; });
  removeError = router.onError(() => { navigating.value = false; });
  loadLock();
});
onBeforeUnmount(() => { clearTimeout(idleTimer); window.removeEventListener('admin:locked', handleLocked); activityEvents.forEach((event) => window.removeEventListener(event, resetIdleTimer)); });
onBeforeUnmount(() => { removeBefore?.(); removeAfter?.(); removeError?.(); });
watch(lockScope, resetIdleTimer);
</script>

<template>
  <div v-if="lockReady" class="admin-shell" :class="{ 'sidebar-collapsed': collapsed, 'mobile-nav-open': mobileOpen, 'gate-active': lockEnabled && lockScope !== 'b' }">
    <AdminSidebar v-if="!lockEnabled || lockScope === 'b'" :collapsed="collapsed" :access-permissions="accessPermissions" @close="mobileOpen = false" />
    <button v-if="mobileOpen" class="sidebar-scrim" aria-label="关闭菜单" @click="mobileOpen = false"></button>
    <main class="admin-main">
      <div v-if="navigating" class="route-progress" aria-hidden="true"><i></i></div>
      <AdminTopbar v-if="!lockEnabled || lockScope === 'b'" @toggle-sidebar="toggleSidebar" @lock="lockNow" />
      <AdminGate v-if="lockEnabled && lockScope !== 'b'" :scope="lockScope" @scope="lockScope = $event" />
      <RouterView v-else v-slot="{ Component, route: viewRoute }">
        <Transition name="admin-route" mode="out-in">
          <KeepAlive :max="12">
            <Suspense>
              <template #default><component :is="Component" :key="viewRoute.name" /></template>
              <template #fallback><div class="route-loading"><span></span>正在打开页面…</div></template>
            </Suspense>
          </KeepAlive>
        </Transition>
      </RouterView>
    </main>
    <ConfirmDialog />
  </div>
</template>
