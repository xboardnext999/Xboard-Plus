export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function money(value, symbol = '¥') {
  const number = Number(value || 0) / 100;
  return `${symbol}${number.toFixed(2)}`;
}

export function bytes(value) {
  const size = Number(value || 0);
  if (size <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return `${(size / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export function percent(used, total) {
  const denominator = Number(total || 0);
  if (!denominator) return 0;
  return Math.min(100, Math.max(0, Math.round((Number(used || 0) / denominator) * 100)));
}

export function time(value) {
  if (!value) return '-';
  const date = typeof value === 'number' || /^\d+$/.test(String(value))
    ? new Date(Number(value) * 1000)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', { hour12: false });
}

export function date(value) {
  if (!value) return '-';
  const dateValue = typeof value === 'number' || /^\d+$/.test(String(value))
    ? new Date(Number(value) * 1000)
    : new Date(value);

  if (Number.isNaN(dateValue.getTime())) return '-';
  return dateValue.toLocaleDateString('zh-CN');
}

export function statusText(value, map) {
  return map[Number(value)] || map[String(value)] || '未知';
}

export function queryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  return search.toString();
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', 'readonly');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const success = document.execCommand('copy');
  input.remove();
  return success;
}

export function normalizeCollection(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload && typeof payload === 'object') return Object.values(payload);
  return [];
}
