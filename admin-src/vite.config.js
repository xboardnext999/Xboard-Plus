import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    outDir: '../public/assets/admin-vue',
    emptyOutDir: true,
    manifest: 'manifest.json',
    sourcemap: true,
  },
});
