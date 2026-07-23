import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(projectRoot, 'src'),
    },
  },
  build: {
    outDir: '../public/assets/admin-react',
    emptyOutDir: true,
    manifest: 'manifest.json',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/.test(id)) return 'vendor-react';
          if (id.includes('node_modules/@base-ui/')) return 'vendor-ui';
          if (id.includes('node_modules/lucide-react/')) return 'vendor-icons';
          if (id.includes('node_modules/@codemirror/') || id.includes('node_modules/codemirror/')) return 'vendor-editor';
          return undefined;
        },
      },
    },
  },
});
