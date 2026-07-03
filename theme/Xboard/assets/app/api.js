const API_BASE = '/api/v1';
const TOKEN_KEY = 'Vue_Naive_access_token';

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function parseTokenRecord() {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (!stored) return null;

  try {
    const record = JSON.parse(stored);
    if (record && typeof record === 'object') return record;
  } catch (_) {
    return { value: stored };
  }

  return null;
}

export function getToken() {
  const record = parseTokenRecord();
  if (!record?.value) return '';

  if (record.expire && record.time && nowSeconds() - Number(record.time) > Number(record.expire)) {
    clearToken();
    return '';
  }

  return record.value;
}

export function setToken(authData) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify({
    value: authData,
    time: nowSeconds(),
    expire: 86400 * 365,
  }));
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated() {
  return Boolean(getToken());
}

function buildUrl(path, data) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

function buildBody(data) {
  const body = new URLSearchParams();
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) body.set(key, value);
  });
  return body;
}

function getLanguage() {
  return localStorage.getItem('xboard_plus_lang') || 'zh-CN';
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
}

export async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    Accept: 'application/json',
    'Content-Language': getLanguage(),
  };

  if (options.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = token;
  }

  const fetchOptions = {
    method,
    headers,
    credentials: 'same-origin',
  };

  let url = `${API_BASE}${path}`;
  if (method === 'GET') {
    url = buildUrl(path, options.data);
  } else if (options.data instanceof FormData) {
    fetchOptions.body = options.data;
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
    fetchOptions.body = buildBody(options.data);
  }

  const response = await fetch(url, fetchOptions);
  const payload = await parseResponse(response);

  if (response.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent('xboard:auth-expired'));
    throw new Error('登录已过期，请重新登录');
  }

  if (payload && typeof payload === 'object' && payload.status === 'fail') {
    throw new Error(payload.message || '请求失败');
  }

  if (!response.ok) {
    const message = payload?.message || response.statusText || '请求失败';
    throw new Error(message);
  }

  if (payload && typeof payload === 'object' && payload.status === 'success') {
    return payload.data;
  }

  return payload;
}

export const api = {
  get(path, data, options = {}) {
    return request(path, { ...options, method: 'GET', data });
  },
  post(path, data, options = {}) {
    return request(path, { ...options, method: 'POST', data });
  },
};
