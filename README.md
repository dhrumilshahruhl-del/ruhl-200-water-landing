# RUHL / Rockrose - 200 Water Street Landing Page

Static **HTML / CSS / JavaScript** landing page for the 200 Water Street ventilation retrofit project. It runs with **no build step** and is prepared to be served from:

```text
https://ruhl.org/200-water/
```

All project-owned runtime assets use relative paths so the same folder can be moved later without being tied to a personal hosting URL.

## Local preview

Use any static server from the project root, for example:

```bash
python -m http.server 8080
```

Then open http://localhost:8080/

The 3D model section requires HTTP(S); opening `index.html` directly from the filesystem will intentionally show a local-file warning.

## Repo layout

| Path | Purpose |
|------|---------|
| `index.html` | Full page markup; Tailwind via CDN |
| `styles.css` | Custom fonts, scroll behavior, `.reveal` animation |
| `main.js` | Scroll reveal (`IntersectionObserver`) + Lucide icon wiring |
| `building-scroll.js` | GSAP ScrollTrigger + Three.js 3D building section |
| `building-rooftop-mode.js` | Rooftop detail overlay interaction |
| `model-preload.js` | Shared GLB preload/cache helper |
| `rooftop-camera.js` | Rooftop camera and model alignment helpers |
| `rooftop-labels.js` | Rooftop callouts, labels, and flow overlays |
| `rooftop-retrofit.js` | Procedural rooftop retrofit visualization helpers |
| `logos/` | Partner images and GLB models |

Third-party CDN dependencies:

- Tailwind styling: `cdn.tailwindcss.com`
- Icons: Lucide (`jsdelivr` UMD bundle)
- Fonts: Google Fonts Roboto
- 3D section: Three.js + GSAP ScrollTrigger (CDN / import map)

## RUHL server deployment

Upload these runtime files and folders into the RUHL web server directory that maps to `/200-water/`:

```text
index.html
styles.css
main.js
building-scroll.js
building-rooftop-mode.js
model-preload.js
rooftop-camera.js
rooftop-labels.js
rooftop-retrofit.js
logos/
```

The server should then expose the entry page at:

```text
/200-water/index.html
```

The `scripts/`, `.github/`, `.agents/`, `.cursor/`, `.git/`, `node_modules/`, `CHAT_HANDOFF.md`, `building-scroll-recipe.md`, `LICENSE`, `.gitignore`, `.nojekyll`, and README files are not required for production hosting.

## Logo sizing

Adjust logo dimensions in **`index.html`** on each `<img>` in the Organizations grid (Tailwind classes like `max-h-28`, `max-w-[260px]`), matching the intent of the old `partners` array in React.
