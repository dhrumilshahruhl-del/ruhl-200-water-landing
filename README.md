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
| `logos/` | Partner images (see `logos/README.md`) |
| `.nojekyll` | Disables Jekyll so Pages serves static assets as-is |

Third-party CDN (pinned where possible):

- Tailwind styling: `cdn.tailwindcss.com`
- Icons: Lucide (`jsdelivr` UMD bundle)
- Fonts: Google Fonts Roboto

## GitHub Pages (recommended)

Because the site is plain static HTML, **GitHub can serve it straight from `main`** — no Actions required.

1. **Settings → Pages → Build and deployment**
2. **Source**: **Deploy from a branch**
3. **Branch**: `main`, folder **`/ (root)`**
4. Save. The site publishes at **`https://<your-username>.github.io/<repo>/`**.

Example (this repo names): **`https://bunny-bun-ux.github.io/ruhl-200-water-landing/`**

Ensure image files listed in `logos/README.md` exist under **`logos/`** so partner tiles show correctly.

### Optional Actions deploy

Earlier versions used a Node/Vite build and GitHub Actions. That path was removed when the project moved to fully static assets. Restore a workflow later only if you reintroduce a build step.

## Logo sizing

Adjust logo dimensions in **`index.html`** on each `<img>` in the Organizations grid (Tailwind classes like `max-h-28`, `max-w-[260px]`), matching the intent of the old `partners` array in React.
