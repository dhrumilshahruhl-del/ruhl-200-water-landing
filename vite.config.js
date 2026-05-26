import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** GitHub Pages project site path: /<repo>/ */
const pagesBase = '/ruhl-200-water-landing/';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function createPlugins(command) {
  /** GitHub Pages serves `404.html` for unknown routes; copying `index.html` keeps SPA-style apps working. */
  const githubPagesArtifacts =
    command === 'build'
      ? {
          name: 'github-pages-artifacts',
          closeBundle() {
            const dist = resolve(__dirname, 'dist');
            copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'));
          },
        }
      : null;

  return [react(), githubPagesArtifacts].filter(Boolean);
}

export default defineConfig(({ command }) => ({
  plugins: createPlugins(command),
  /** Use `/ruhl-200-water-landing/` whenever we emit `dist/` (covers `vite build --mode …`). */
  base: command === 'build' ? pagesBase : '/',
}));
