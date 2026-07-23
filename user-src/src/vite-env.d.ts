/// <reference types="vite/client" />

interface RuntimeSettings {
  title?: string
  logo?: string
  assets_path?: string
  description?: string
  background_url?: string
  version?: string
  theme?: { color?: string }
  i18n?: string[]
}

interface Window {
  settings?: RuntimeSettings
  routerBase?: string
  L?: any
}
