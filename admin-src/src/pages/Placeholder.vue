<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const title = computed(() => route.meta.title || '后台页面');
</script>

<template>
  <section class="page-stack">
    <div class="page-heading">
      <h1>{{ title }}</h1>
      <p>这个页面已在源码路由中预留，可以按现有后台接口继续迁移。</p>
    </div>

    <section class="panel placeholder-panel">
      <h2>{{ title }}</h2>
      <p>当前先保留和后台一致的结构入口，避免直接修改压缩后的打包产物。</p>
    </section>
  </section>
</template>
