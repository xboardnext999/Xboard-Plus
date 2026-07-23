import { LEGACY_LANGUAGE_STORAGE_KEY, LANGUAGE_STORAGE_KEY } from "@/lib/runtime"

const API_BASE = "/api/v1"
export const TOKEN_KEY = "Vue_Naive_access_token"

type QueryValue = string | number | boolean | null | undefined
export type RequestData = Record<string, unknown> | FormData

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

function tokenRecord(): { value?: string; time?: number; expire?: number } | null {
  const stored = localStorage.getItem(TOKEN_KEY)
  if (!stored) return null
  try {
    const parsed = JSON.parse(stored)
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return { value: stored }
  }
}

export function getToken() {
  const record = tokenRecord()
  if (!record?.value) return ""
  if (record.expire && record.time && nowSeconds() - Number(record.time) > Number(record.expire)) {
    clearToken()
    return ""
  }
  return record.value
}

export function setToken(value: string) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ value, time: nowSeconds(), expire: 86400 * 365 }))
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated() {
  return Boolean(getToken())
}

function appendBody(body: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null) return
  if (Array.isArray(value)) {
    value.forEach((entry, index) => appendBody(body, `${key}[${index}]`, entry))
    return
  }
  if (typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => {
      appendBody(body, `${key}[${childKey}]`, childValue)
    })
    return
  }
  body.set(key, String(value))
}

function buildBody(data?: RequestData) {
  if (data instanceof FormData) return data
  const body = new URLSearchParams()
  Object.entries(data || {}).forEach(([key, value]) => appendBody(body, key, value))
  return body
}

function buildUrl(path: string, data?: Record<string, QueryValue>) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value))
  })
  return url.toString()
}

async function parseResponse(response: Response): Promise<any> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export class ApiError extends Error {
  status: number
  payload: unknown
  constructor(message: string, status = 0, payload?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.payload = payload
  }
}

export async function request<T = any>(
  path: string,
  options: { method?: "GET" | "POST"; data?: RequestData | Record<string, QueryValue>; auth?: boolean; signal?: AbortSignal } = {},
): Promise<T> {
  const method = options.method || "GET"
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Language": localStorage.getItem(LANGUAGE_STORAGE_KEY) || localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY) || "zh-CN",
  }
  if (options.auth !== false) {
    const token = getToken()
    if (token) headers.Authorization = token
  }
  let url = `${API_BASE}${path}`
  const init: RequestInit = { method, headers, credentials: "same-origin", signal: options.signal }
  if (method === "GET") {
    url = buildUrl(path, options.data as Record<string, QueryValue>)
  } else {
    const body = buildBody(options.data as RequestData)
    init.body = body
    if (!(body instanceof FormData)) headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8"
  }
  const response = await fetch(url, init)
  const payload = await parseResponse(response)
  if (response.status === 401) {
    clearToken()
    window.dispatchEvent(new CustomEvent("xboard:auth-expired"))
    throw new ApiError("登录已过期，请重新登录", 401, payload)
  }
  if (payload && typeof payload === "object" && payload.status === "fail") {
    const message = Array.isArray(payload.message) ? payload.message.join("，") : payload.message
    throw new ApiError(message || "请求失败", response.status, payload)
  }
  if (!response.ok) throw new ApiError(payload?.message || response.statusText || "请求失败", response.status, payload)
  if (payload && typeof payload === "object" && payload.status === "success") return payload.data as T
  return payload as T
}

export const api = {
  get<T = any>(path: string, data?: Record<string, QueryValue>, options: { auth?: boolean; signal?: AbortSignal } = {}) {
    return request<T>(path, { ...options, method: "GET", data })
  },
  post<T = any>(path: string, data?: RequestData, options: { auth?: boolean; signal?: AbortSignal } = {}) {
    return request<T>(path, { ...options, method: "POST", data })
  },
}
