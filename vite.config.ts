import { defineConfig } from 'vite';

// Relative base so the built app works from any static path
// (GitHub Pages project sites, file servers, etc.).
export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: false },
});
