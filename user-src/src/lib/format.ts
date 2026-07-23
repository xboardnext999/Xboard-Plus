import DOMPurify from "dompurify"

export function money(value: unknown, symbol = "¥") {
  const number = Number(value || 0) / 100
  return `${symbol}${number.toFixed(2)}`
}

export function bytes(value: unknown) {
  const size = Number(value || 0)
  if (size <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)
  return `${(size / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`
}

export function percent(used: unknown, total: unknown) {
  const denominator = Number(total || 0)
  return denominator ? Math.min(100, Math.max(0, Math.round((Number(used || 0) / denominator) * 100))) : 0
}

export function formatTime(value: unknown) {
  if (!value) return "-"
  const raw = String(value)
  const parsed = typeof value === "number" || /^\d+$/.test(raw) ? new Date(Number(value) * 1000) : new Date(raw)
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString("zh-CN", { hour12: false })
}

export function formatDate(value: unknown) {
  if (!value) return "-"
  const raw = String(value)
  const parsed = typeof value === "number" || /^\d+$/.test(raw) ? new Date(Number(value) * 1000) : new Date(raw)
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString("zh-CN")
}

export function statusText(value: unknown, map: Record<string | number, string>) {
  return map[Number(value)] || map[String(value)] || "未知"
}

export async function copyText(value: unknown) {
  const text = String(value ?? "")
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const input = document.createElement("textarea")
  input.value = text
  input.readOnly = true
  input.style.cssText = "position:fixed;opacity:0"
  document.body.appendChild(input)
  input.select()
  document.execCommand("copy")
  input.remove()
}

export function sanitizeHtml(value: unknown) {
  return DOMPurify.sanitize(String(value || ""), {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel"],
  })
}

export function markdownHtml(value: unknown) {
  const escaped = String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
  const html = escaped
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^[-*] (.*)$/gm, "<li>$1</li>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>")
  return sanitizeHtml(html)
}
