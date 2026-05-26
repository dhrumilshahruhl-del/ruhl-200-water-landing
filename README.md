# RUHL / Rockrose — 200 Water Street Landing Page

React + Vite landing page prototype for the 200 Water Street ventilation retrofit project.

## Local setup

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Logo sizing

Logo files are in:

```text
public/logos/
```

Logo sizes can be adjusted in `src/App.jsx` inside the `partners` array:

```js
logoClass: 'max-h-28 max-w-[260px]'
```

The shared logo card container is in the `LogoMark` component:

```jsx
<div className="flex h-40 ...">
```

Increase `h-40` to `h-44` or `h-48` if larger logos need more room.

## Deploy options

Recommended free options:
- Vercel
- Netlify
- GitHub Pages — see below

### GitHub Pages (this repo)

This app is compiled by Vite. **Do not** set Pages to “Deploy from a branch” with the repo root (`/`), or visitors only get raw `index.html` and `/src/main.jsx`, which Pages cannot compile.

Instead:

1. Push this repo including `.github/workflows/pages.yml`.
2. On GitHub: **Settings → Pages → Build and deployment**.
3. Under **Source**, choose **GitHub Actions** (not “Deploy from a branch”).
4. Open the **Actions** tab and confirm the workflow “Deploy site to Pages” completed; the live URL is **`https://bunny-bun-ux.github.io/ruhl-200-water-landing/`**.

Production builds use [`vite.config.js`](vite.config.js) with `base: '/ruhl-200-water-landing/'` so asset URLs work under that path (applied on every `vite build`, even with a custom `--mode`). The build also copies `dist/index.html` to `dist/404.html` for GitHub Pages, and [`public/.nojekyll`](public/.nojekyll) is published so Jekyll does not strip static assets. If you rename the repo, update `pagesBase` in `vite.config.js` and redeploy.

To verify a production build locally after `npm run build`, either run **`npm run preview`** or open [`dist/index.html`](dist/index.html) from a server (opening the file directly with `file://` will not resolve module paths correctly).
