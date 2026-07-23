import path from "node:path"
import { readdir, rm } from "node:fs/promises"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, type Plugin } from "vite"

const trimBundleWhitespace = (): Plugin => ({
  name: "trim-bundle-trailing-whitespace",
  generateBundle(_options, bundle) {
    for (const output of Object.values(bundle)) {
      if (output.type === "chunk") {
        output.code = output.code.replace(/[ \t]+$/gm, "")
      }
    }
  },
})

const cleanGeneratedAssets = (): Plugin => ({
  name: "clean-generated-user-assets",
  async buildStart() {
    const outputRoot = path.resolve(__dirname, "../theme/Xboard/assets/app")
    // Keep the hand-maintained icons/ and flags/ directories while preventing
    // stale hashed route chunks or font assets from surviving a new build.
    const generatedEntries = await readdir(outputRoot, { withFileTypes: true })
      .then((entries) => entries
        .filter((entry) => entry.isFile() && /^main(?:-[A-Za-z0-9_-]+)?\.js$/.test(entry.name))
        .map((entry) => rm(path.join(outputRoot, entry.name), { force: true })))
      .catch(() => [])
    await Promise.all([
      ...generatedEntries,
      rm(path.join(outputRoot, "chunks"), { recursive: true, force: true }),
      rm(path.join(outputRoot, "assets"), { recursive: true, force: true }),
    ])
  },
})

export default defineConfig({
  base: "./",
  plugins: [cleanGeneratedAssets(), react(), tailwindcss(), trimBundleWhitespace()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    outDir: "../theme/Xboard/assets/app",
    emptyOutDir: false,
    manifest: "manifest.json",
    sourcemap: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(__dirname, "src/main.tsx"),
      output: {
        // Keep the entry URL content-addressed. Route chunks import shared
        // providers back from the entry; a query-string cache key on only the
        // initial request would otherwise make the browser instantiate the
        // entry (and its React contexts) twice.
        entryFileNames: "main-[hash].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/.test(id)) return "vendor-react"
          if (id.includes("node_modules/@tanstack/")) return "vendor-query"
          if (id.includes("node_modules/@radix-ui/")) return "vendor-radix"
          if (id.includes("node_modules/lucide-react/")) return "vendor-icons"
          if (id.includes("node_modules/dompurify/") || id.includes("node_modules/sonner/")) return "vendor-utils"
          return undefined
        },
        assetFileNames: (assetInfo) => {
          const originalName = assetInfo.names?.[0] || assetInfo.name || "asset"
          return originalName.endsWith(".css") ? "styles.css" : "assets/[name]-[hash][extname]"
        },
      },
    },
  },
})
