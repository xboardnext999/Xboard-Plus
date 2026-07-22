<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import { basicSetup } from 'codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { linter, lintGutter } from '@codemirror/lint';

const props = defineProps({ modelValue: { type: Object, required: true }, fields: { type: Array, default: () => [] } });
const emit = defineEmits(['update:modelValue']);
const activeKey = ref('');
const editorHost = ref(null);
const error = ref('');
const copied = ref(false);
const fullscreen = ref(false);
const stats = reactive({ lines: 1, characters: 0 });
const baseline = reactive({});
let editor;
let syncing = false;

const entries = computed(() => props.fields.map((field) => ({ ...field, language: field.language || (/singbox/i.test(field.key) ? 'json' : /surge|surfboard/i.test(field.key) ? 'ini' : 'yaml') })));
const active = computed(() => entries.value.find((field) => field.key === activeKey.value) || entries.value[0]);
const changed = (key) => String(props.modelValue[key] || '') !== String(baseline[key] || '');
function updateStats(doc) { stats.lines = doc.lines; stats.characters = doc.length; }

function extensions(field) {
  const language = field?.language === 'json' ? [json(), linter(jsonParseLinter())] : field?.language === 'yaml' ? [yaml()] : [];
  return [basicSetup, lintGutter(), keymap.of([indentWithTab]), ...language,
    EditorView.lineWrapping,
    EditorView.theme({
      '&': { height: '560px', backgroundColor: 'transparent', fontSize: '13px' },
      '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', lineHeight: '1.65' },
      '.cm-content': { padding: '14px 0' }, '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: '#7890aa' },
      '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'rgba(37, 99, 235, .06)' },
      '&.cm-focused': { outline: 'none' }, '.cm-foldGutter': { width: '14px' },
    }),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged || syncing || !active.value) return;
      error.value = '';
      updateStats(update.state.doc);
      emit('update:modelValue', { ...props.modelValue, [active.value.key]: update.state.doc.toString() });
    })];
}
function createEditor() {
  if (!editorHost.value || !active.value) return;
  editor?.destroy();
  editor = new EditorView({ parent: editorHost.value, state: EditorState.create({ doc: props.modelValue[active.value.key] || '', extensions: extensions(active.value) }) });
  updateStats(editor.state.doc);
}
async function copy() {
  await navigator.clipboard.writeText(editor?.state.doc.toString() || '');
  copied.value = true; window.clearTimeout(copy.timer); copy.timer = window.setTimeout(() => { copied.value = false; }, 1500);
}
function toggleFullscreen() { fullscreen.value = !fullscreen.value; nextTick(() => editor?.requestMeasure()); }
function markSaved() { entries.value.forEach((field) => { baseline[field.key] = props.modelValue[field.key] || ''; }); }
defineExpose({ markSaved });
function select(key) { if (key === activeKey.value) return; activeKey.value = key; error.value = ''; nextTick(createEditor); }
function format() {
  if (active.value?.language !== 'json') return;
  try {
    const formatted = JSON.stringify(JSON.parse(editor.state.doc.toString()), null, 2);
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: formatted } });
    error.value = '';
  } catch (e) { error.value = `JSON 格式错误：${e.message}`; }
}

watch(() => props.fields, () => { if (!entries.value.some((field) => field.key === activeKey.value)) activeKey.value = entries.value[0]?.key || ''; nextTick(createEditor); }, { immediate: true });
watch(() => props.modelValue[activeKey.value], (value) => {
  if (!editor || value === editor.state.doc.toString()) return;
  syncing = true; editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value || '' } }); syncing = false;
});
function handleKeydown(event) { if (event.key === 'Escape' && fullscreen.value) toggleFullscreen(); }
onMounted(() => { activeKey.value ||= entries.value[0]?.key || ''; markSaved(); window.addEventListener('keydown', handleKeydown); nextTick(createEditor); });
onBeforeUnmount(() => { editor?.destroy(); window.removeEventListener('keydown', handleKeydown); });
</script>

<template>
  <div class="template-code-editor" :class="{ fullscreen }">
    <div class="template-tabs" role="tablist" aria-label="订阅模板类型">
      <button v-for="field in entries" :key="field.key" type="button" :class="{ active: field.key === activeKey, changed: changed(field.key) }" role="tab" :aria-selected="field.key === activeKey" @click="select(field.key)"><span>{{ field.tabLabel || field.label.replace(' 模板', '') }}</span><i v-if="changed(field.key)" title="尚未保存"></i></button>
    </div>
    <div class="template-editor-head">
      <div><h3>{{ active?.label }}</h3><p>{{ active?.help || `配置 ${active?.tabLabel || active?.label.replace(' 模板', '')} 客户端的订阅模板。` }}</p></div>
      <div class="template-editor-tools">
        <span class="editor-stat">{{ stats.lines }} 行 · {{ stats.characters }} 字符</span><span class="language-badge">{{ active?.language?.toUpperCase() }}</span>
        <button type="button" class="editor-tool" :title="copied ? '已复制' : '复制代码'" @click="copy"><AppIcon :name="copied ? 'Check' : 'Copy'" :size="15" /><span>{{ copied ? '已复制' : '复制' }}</span></button>
        <button v-if="active?.language === 'json'" type="button" class="editor-tool" title="格式化 JSON" @click="format"><AppIcon name="AlignLeft" :size="15" /><span>格式化</span></button>
        <button type="button" class="editor-tool" :title="fullscreen ? '退出全屏' : '全屏编辑'" @click="toggleFullscreen"><AppIcon :name="fullscreen ? 'Minimize2' : 'Maximize2'" :size="15" /><span>{{ fullscreen ? '退出全屏' : '全屏' }}</span></button>
      </div>
    </div>
    <div class="code-editor-frame" :class="{ invalid: error }"><div ref="editorHost"></div></div>
    <p v-if="error" class="template-error">{{ error }}</p>
    <p v-else class="template-help">支持行号、语法高亮、代码折叠、搜索和快捷键；编辑后请点击右上角“保存设置”。</p>
  </div>
</template>
