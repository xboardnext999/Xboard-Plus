type QueryValue = string | number | boolean | null | undefined;
type Query = Record<string, QueryValue>;

export interface ApiEnvelope<T = unknown> {
  code?: number | string;
  data?: T;
  message?: string;
  state?: string;
  status?: string;
  [key: string]: unknown;
}

const tokenKeys = ['XBOARD_ACCESS_TOKEN', 'token', 'access_token'] as const;
const inflightGets = new Map<string, Promise<unknown>>();

function cleanSlash(value: unknown) {
  return String(value || '').replace(/^\/|\/$/g, '');
}

export function appBaseUrl() {
  const base = window.settings?.base_url || '/';
  return String(base).replace(/\/$/, '');
}

export function securePath() {
  return cleanSlash(window.settings?.secure_path);
}

export function adminHome() {
  return `${appBaseUrl()}/${securePath()}`.replace(/\/$/, '');
}

export function adminApi(path: string) {
  const prefix = `${appBaseUrl()}/api/v2/${securePath()}`;
  return `${prefix}${path.startsWith('/') ? path : `/${path}`}`;
}

export function authToken() {
  const raw = tokenKeys.map((key) => localStorage.getItem(key)).find(Boolean) || '';
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw) as { value?: string; token?: string } | string;
    return typeof parsed === 'string' ? parsed : parsed.value || parsed.token || raw;
  } catch {
    return raw;
  }
}

export function clearAuthTokens() {
  tokenKeys.forEach((key) => localStorage.removeItem(key));
}

export function hasAuthToken() {
  return Boolean(authToken());
}

function validateResponse<T>(response: Response, json: ApiEnvelope<T>) {
  if (response.status === 401 || response.status === 403) {
    window.dispatchEvent(new CustomEvent('admin:unauthorized'));
  }
  if (response.status === 423) {
    window.dispatchEvent(new CustomEvent('admin:locked', { detail: json.state || 'locked' }));
  }
  if (!response.ok || json.status === 'fail' || (json.code && Number(json.code) !== 0)) {
    throw new Error(json.message || '请求失败');
  }
}

export async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  headers.set('Content-Language', localStorage.getItem('i18nextLng') || 'zh-CN');

  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const token = authToken();
  if (token) headers.set('Authorization', token.startsWith('Bearer ') ? token : `Bearer ${token}`);

  const response = await fetch(adminApi(path), {
    credentials: 'include',
    ...options,
    headers,
  });
  const json = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  validateResponse(response, json);
  return (json.data ?? json) as T;
}

export function toQuery(params: Query = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  return query.toString();
}

export function get<T = unknown>(path: string, params: Query = {}): Promise<T> {
  const query = toQuery(params);
  const resource = `${path}${query ? `?${query}` : ''}`;
  const existing = inflightGets.get(resource);
  if (existing) return existing as Promise<T>;

  const pending = request<T>(resource).finally(() => inflightGets.delete(resource));
  inflightGets.set(resource, pending);
  return pending;
}

export async function getEnvelope<T extends ApiEnvelope = ApiEnvelope>(path: string, params: Query = {}): Promise<T> {
  const query = toQuery(params);
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Language': localStorage.getItem('i18nextLng') || 'zh-CN',
  });
  const token = authToken();
  if (token) headers.set('Authorization', token.startsWith('Bearer ') ? token : `Bearer ${token}`);

  const response = await fetch(adminApi(`${path}${query ? `?${query}` : ''}`), {
    credentials: 'include',
    headers,
  });
  const json = (await response.json().catch(() => ({}))) as T;
  validateResponse(response, json);
  return json;
}

export function post<T = unknown>(path: string, body: unknown = {}): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

export function errorMessage(error: unknown, fallback = '请求失败') {
  return error instanceof Error ? error.message : fallback;
}
