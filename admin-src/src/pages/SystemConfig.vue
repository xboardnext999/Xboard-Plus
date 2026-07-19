<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import SmartEditor from '../components/SmartEditor.vue';
import TemplateCodeEditor from '../components/TemplateCodeEditor.vue';
import { configSections } from '../config/systemConfig';
import { get, post } from '../services/http';

const activeKey = ref('site');
const loading = ref(true);
const saving = ref(false);
const acting = ref(false);
const templateEditor = ref(null);
const message = reactive({ text: '', type: 'success' });
const configs = reactive({});
const active = computed(() => configSections.find((section) => section.key === activeKey.value));
const model = computed({ get: () => configs[activeKey.value] || {}, set: (value) => { configs[activeKey.value] = value; } });

function notify(text, type = 'success') { message.text = text; message.type = type; window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => { message.text = ''; }, 3000); }
async function load() { loading.value = true; try { Object.assign(configs, await get('/config/fetch')); } catch (e) { notify(e.message, 'error'); } finally { loading.value = false; } }
async function save() { saving.value = true; try { await post('/config/save', configs[activeKey.value]); templateEditor.value?.markSaved(); notify(`${active.value.title}已保存`); } catch (e) { notify(e.message, 'error'); } finally { saving.value = false; } }
async function runAction() {
  acting.value = true;
  try {
    if (active.value.action === 'mail') await post('/config/testSendMail');
    if (active.value.action === 'telegram') await post('/config/setTelegramWebhook', configs.telegram);
    notify(active.value.action === 'mail' ? '测试邮件已发送' : 'Telegram Webhook 已设置');
  } catch (e) { notify(e.message, 'error'); } finally { acting.value = false; }
}
onMounted(load);
</script>

<template>
  <section class="page-stack">
    <div class="page-heading"><h1>系统配置</h1><p>管理站点、订阅、安全、通知和节点通信等核心设置。</p></div>
    <div class="settings-shell">
      <nav class="settings-nav" aria-label="系统配置分类">
        <button v-for="section in configSections" :key="section.key" :class="{ active: activeKey === section.key }" @click="activeKey = section.key"><AppIcon :name="section.icon" :size="17" /><span>{{ section.title }}</span></button>
      </nav>
      <section class="panel settings-content">
        <div class="panel-head settings-head"><div><h2>{{ active.title }}</h2><p>{{ active.description }}</p></div><div class="settings-actions"><button v-if="active.action" class="btn btn-ghost" :disabled="acting || loading" @click="runAction">{{ acting ? '执行中…' : active.action === 'mail' ? '发送测试邮件' : '设置 Webhook' }}</button><button class="btn btn-primary" :disabled="saving || loading" @click="save">{{ saving ? '保存中…' : '保存设置' }}</button></div></div>
        <div v-if="loading" class="settings-loading">正在加载配置…</div>
        <TemplateCodeEditor v-else-if="active.wide" ref="templateEditor" v-model="model" :fields="active.fields" />
        <SmartEditor v-else v-model="model" :fields="active.fields" />
      </section>
    </div>
    <div v-if="message.text" class="toast" :class="{ error: message.type === 'error' }">{{ message.text }}</div>
  </section>
</template>
