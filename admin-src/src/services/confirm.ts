export interface ConfirmOptions {
  title?: string;
  message: string;
  danger?: boolean;
  confirmText?: string;
}

export interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  danger: boolean;
  confirmText: string;
}

const initialState: ConfirmState = {
  open: false,
  title: '确认操作',
  message: '',
  danger: false,
  confirmText: '确认',
};

let state = initialState;
let resolver: ((result: boolean) => void) | null = null;
const listeners = new Set<() => void>();

function publish(next: ConfirmState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function subscribeConfirm(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getConfirmSnapshot() {
  return state;
}

export function confirmAction(options: ConfirmOptions | string) {
  const config = typeof options === 'string' ? { message: options } : options;
  resolver?.(false);
  publish({
    open: true,
    title: config.title || '确认操作',
    message: config.message || '',
    danger: Boolean(config.danger),
    confirmText: config.confirmText || '确认',
  });

  return new Promise<boolean>((resolve) => {
    resolver = resolve;
  });
}

export function resolveConfirm(result: boolean) {
  const currentResolver = resolver;
  resolver = null;
  publish({ ...state, open: false });
  currentResolver?.(result);
}
