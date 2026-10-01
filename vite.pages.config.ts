import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const path = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url));

// A standalone client build for GitHub Pages. Reuse the same game and UI;
// no Sites sign-in, Worker, server rendering, or external assets are required.
export default defineConfig({
  root: path('./github-pages/'),
  base: './',
  publicDir: path('./public/'),
  plugins: [react()],
  resolve: { alias: { '@': path('./') } },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: {
    outDir: path('./dist-github/'),
    emptyOutDir: true,
  },
});
