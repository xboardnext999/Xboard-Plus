export const settings: RuntimeSettings = window.settings || {}

export const THEME_STORAGE_KEY = "xboard-plus-theme"
export const LANGUAGE_STORAGE_KEY = "xboard-plus-language"
export const LEGACY_LANGUAGE_STORAGE_KEY = "xboard_plus_lang"
export const CART_STORAGE_KEY = "xboard-digital-cart-v1"

export const languageOptions = [
  { code: "zh-CN", short: "简", label: "简体中文", flag: "CN.png", rtl: false },
  { code: "zh-TW", short: "繁", label: "繁體中文", flag: "TW.png", rtl: false },
  { code: "en-US", short: "EN", label: "English", flag: "US.png", rtl: false },
  { code: "ja-JP", short: "日", label: "日本語", flag: "JP.png", rtl: false },
  { code: "ko-KR", short: "한", label: "한국어", flag: "KR.png", rtl: false },
  { code: "ru-RU", short: "RU", label: "Русский", flag: "RU.png", rtl: false },
  { code: "vi-VN", short: "VI", label: "Tiếng Việt", flag: "VN.png", rtl: false },
  { code: "fil-PH", short: "PH", label: "Filipino", flag: "PH.png", rtl: false },
  { code: "ms-MY", short: "MS", label: "Bahasa Melayu", flag: "MY.png", rtl: false },
  { code: "fa-IR", short: "فا", label: "فارسی", flag: "IR.png", rtl: true },
] as const

export function appName() {
  return settings.title || "Xboard Plus"
}

export function appAsset(file: string) {
  const base = settings.assets_path || "/theme/Xboard/assets"
  return `${base.replace(/\/$/, "")}/app/${file.replace(/^\//, "")}`
}

export function logoUrl() {
  const logo = String(settings.logo || "").trim()
  if (!logo) return appAsset("icons/Logo.webp")
  if (/^(https?:)?\/\//i.test(logo) || logo.startsWith("data:") || logo.startsWith("/")) return logo
  return `/${logo.replace(/^\//, "")}`
}

export function readTheme(): "light" | "dark" {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}

export function readLanguage() {
  try {
    const value = localStorage.getItem(LANGUAGE_STORAGE_KEY) || localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY)
    return languageOptions.some((item) => item.code === value) ? value! : "zh-CN"
  } catch {
    return "zh-CN"
  }
}

export function writeLanguage(code: string) {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, code)
  localStorage.setItem(LEGACY_LANGUAGE_STORAGE_KEY, code)
}

export function defaultAvatar() {
  return appAsset("icons/avatar.webp")
}
