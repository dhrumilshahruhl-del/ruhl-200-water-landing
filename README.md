# RUHL / Rockrose — 200 Water Street Landing Page

Static **HTML / CSS / JavaScript** landing page for the 200 Water Street ventilation retrofit project. It runs on **GitHub Pages** with **no build step** (`index.html`, `styles.css`, `main.js` at repo root).

## Local preview

Double-click **`index.html`** or use any static server, for example:

```bash
python -m http.server 8080
```

Then open http://localhost:8080/

## Repo layout

| Path | Purpose |
|------|---------|
| `index.html` | Full page markup; Tailwind via CDN |
| `styles.css` | Custom fonts, scroll behavior, `.reveal` animation |
| `main.js` | Scroll reveal (`IntersectionObserver`) + Lucide icon wiring |
| `building-scroll.js` | GSAP ScrollTrigger + Three.js 3D building section |
| `logos/` | Partner images + `Untitled.glb` (see `logos/README.md`) |
| `.nojekyll` | Disables Jekyll so Pages serves static assets as-is |

Third-party CDN (pinned where possible):

- Tailwind styling: `cdn.tailwindcss.com`
- Icons: Lucide (`jsdelivr` UMD bundle)
- Fonts: Google Fonts Roboto
- 3D section: Three.js + GSAP ScrollTrigger (CDN / import map)

## GitHub Pages

This site is plain static HTML. Deploy it directly from **`main`** — no build step and no Actions deploy.

1. **Settings → Pages → Build and deployment**
2. **Source**: **Deploy from a branch**
3. **Branch**: `main`, folder **`/ (root)`**
4. Save. The site publishes at **`https://dhrumilshahruhl-del.github.io/ruhl-200-water-landing/`**

Do **not** use **Source: GitHub Actions** for this repo. The default `pages build and deployment` workflow has been timing out on deploy; branch deploy from `main` is the supported path.

Ensure files under **`logos/`** (including `Untitled.glb`) are committed on `main` so partner tiles and the 3D section load on Pages.

## Logo sizing

Adjust logo dimensions in **`index.html`** on each `<img>` in the Organizations grid (Tailwind classes like `max-h-28`, `max-w-[260px]`), matching the intent of the old `partners` array in React.
