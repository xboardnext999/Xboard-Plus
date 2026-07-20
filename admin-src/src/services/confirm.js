import { reactive } from 'vue';

export const confirmState = reactive({ open: false, title: '确认操作', message: '', danger: false, confirmText: '确认', resolver: null });

export function confirmAction(options) {
  const config = typeof options === 'string' ? { message: options } : options;
  if (confirmState.resolver) confirmState.resolver(false);
  Object.assign(confirmState, { open: true, title: config.title || '确认操作', message: config.message || '', danger: Boolean(config.danger), confirmText: config.confirmText || '确认' });
  return new Promise((resolve) => { confirmState.resolver = resolve; });
}
export function resolveConfirm(result) {
  const resolver = confirmState.resolver; confirmState.open = false; confirmState.resolver = null; resolver?.(result);
}
