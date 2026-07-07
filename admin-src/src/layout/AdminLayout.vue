<script setup>
import AdminSidebar from '../components/AdminSidebar.vue';
import AdminTopbar from '../components/AdminTopbar.vue';
</script>

<template>
  <div class="admin-shell">
    <AdminSidebar />
    <main class="admin-main">
      <AdminTopbar />
      <RouterView />
    </main>
  </div>
</template>
