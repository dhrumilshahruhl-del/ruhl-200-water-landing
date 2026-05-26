import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** GitHub Pages project URL: /<repo>/ */
const pagesBase = '/ruhl-200-water-landing/';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? pagesBase : '/',
}));
