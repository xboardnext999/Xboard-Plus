<script setup>
import AppIcon from './AppIcon.vue';
import { confirmState, resolveConfirm } from '../services/confirm';
</script>
<template>
  <div v-if="confirmState.open" class="modal-backdrop confirm-backdrop" @click.self="resolveConfirm(false)"><section class="modal-card confirm-dialog" role="alertdialog" aria-modal="true"><div class="confirm-icon" :class="{ danger: confirmState.danger }"><AppIcon :name="confirmState.danger ? 'AlertTriangle' : 'Info'" :size="22" /></div><div><h2>{{ confirmState.title }}</h2><p>{{ confirmState.message }}</p></div><div class="modal-actions"><button class="btn btn-ghost" @click="resolveConfirm(false)">取消</button><button class="btn" :class="confirmState.danger ? 'btn-danger' : 'btn-primary'" @click="resolveConfirm(true)">{{ confirmState.confirmText }}</button></div></section></div>
</template>
