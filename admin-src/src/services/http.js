function cleanSlash(value) {
  return String(value || '').replace(/^\/|\/$/g, '');
}

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
    headers.Authorization = token;
  }

  const response = await fetch(adminApi(path), {
    credentials: 'include',
    ...options,
    headers,
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.status === 'fail') {
    throw new Error(json.message || '请求失败');
  }

  return json.data ?? json;
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
