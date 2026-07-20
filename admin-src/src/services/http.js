function cleanSlash(value) {
  return String(value || '').replace(/^\/|\/$/g, '');
}

// 页面快速切换时，多个组件可能在同一瞬间请求同一个资源。
// 只合并进行中的 GET 请求，不缓存结果，避免后台数据变陈旧。
const inflightGets = new Map();

export function appBaseUrl() {
  const base = (window.settings && window.settings.base_url) || '/';
  return String(base).replace(/\/$/, '');
}

export function securePath() {
  return cleanSlash(window.settings && window.settings.secure_path);
}

export function adminHome() {
  const path = securePath();
  return `${appBaseUrl()}/${path}`.replace(/\/$/, '');
}

export function adminApi(path) {
  const prefix = `${appBaseUrl()}/api/v2/${securePath()}`;
  return `${prefix}${path.startsWith('/') ? path : `/${path}`}`;
}

export function authToken() {
  const raw = localStorage.getItem('XBOARD_ACCESS_TOKEN')
    || localStorage.getItem('token')
    || localStorage.getItem('access_token')
    || '';

  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return parsed?.value || parsed?.token || raw;
  } catch (error) {
    return raw;
  }
}

export async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Language': localStorage.getItem('i18nextLng') || 'zh-CN',
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const token = authToken();
  if (token) {
    headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  const response = await fetch(adminApi(path), {
    credentials: 'include',
    ...options,
    headers,
  });

  const json = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) {
    window.dispatchEvent(new CustomEvent('admin:unauthorized'));
  }
  if (response.status === 423) window.dispatchEvent(new CustomEvent('admin:locked', { detail: json.state || 'locked' }));
  if (!response.ok || json.status === 'fail' || (json.code && Number(json.code) !== 0)) {
    throw new Error(json.message || '请求失败');
  }

  return json.data ?? json;
}

export function get(path, params = {}) {
  const query = toQuery(params);
  const resource = `${path}${query ? `?${query}` : ''}`;
  if (inflightGets.has(resource)) return inflightGets.get(resource);
  const pending = request(resource).finally(() => inflightGets.delete(resource));
  inflightGets.set(resource, pending);
  return pending;
}

export async function getEnvelope(path, params = {}) {
  const query = toQuery(params);
  const headers = { Accept: 'application/json', 'Content-Language': localStorage.getItem('i18nextLng') || 'zh-CN' };
  const token = authToken(); if (token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  const response = await fetch(adminApi(`${path}${query ? `?${query}` : ''}`), { credentials: 'include', headers });
  const json = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) window.dispatchEvent(new CustomEvent('admin:unauthorized'));
  if (response.status === 423) window.dispatchEvent(new CustomEvent('admin:locked', { detail: json.state || 'locked' }));
  if (!response.ok || json.status === 'fail' || (json.code && Number(json.code) !== 0)) throw new Error(json.message || '请求失败');
  return json;
}

export function post(path, body = {}) {
  return request(path, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

export function toQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  return query.toString();
}
