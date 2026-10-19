# RUHL / Rockrose - 200 Water Street Landing Page

Static **HTML / CSS / JavaScript** landing page for the 200 Water Street ventilation retrofit project. The source can be previewed directly; production is packaged with `npm run build` into `dist/`. It is prepared to be served from:

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
| `showroom-integration.js` | Lazy CTA binding, modal, page scroll/focus restoration |
| `virtual-showroom/` | Isolated showroom runtime, local Three.js r170, assets, notices |
| `model-preload.js` | Shared GLB preload/cache helper |
| `scripts/build-production.mjs` | Allowlisted production packaging |
| `logos/` | Partner images and GLB models |

Third-party CDN dependencies:

- Tailwind styling: `cdn.tailwindcss.com`
- Icons: Lucide (`jsdelivr` UMD bundle)
- Fonts: Google Fonts Roboto
- 3D section: Three.js + GSAP ScrollTrigger (CDN / import map)

## RUHL server deployment

Run `npm run build`, then upload the **contents of `dist/`** into the directory mapped to `/200-water/`. Cloudflare's `wrangler.jsonc` now also serves `dist/`. No deployment is performed by the build.

Do not upload the source project wholesale. The build excludes old roof models/controllers, development scripts, audit documents, source asset kits, and node_modules. The showroom's runtime ES modules and local Three.js license remain in the artifact because the browser needs them.

The existing ?Explore rooftop systems? CTA dynamically imports `virtual-showroom/mount.js`. The local runtime mounts inside a Shadow DOM within a native fullscreen dialog. A scoped import map keeps its Three.js r170 graph separate from the parent's existing CDN graph. All showroom downloads start after activation. Native nested equipment/legal dialogs and the original System Flow behavior remain intact.

Closing disposes the runtime, releases the WebGL context, removes transient DOM, restores page scrolling and position, and returns focus to the CTA. Escape retains its existing flow/dialog behavior before closing the outer showroom. The parent building ticker skips rendering while the showroom is open. Parent reduced-motion changes are deferred while open and reconciled when closing.

Standalone runtime assets were copied from the showroom's production build. Approved flow data, impact config, camera choreography, equipment images, and city assets are preserved; integration changes cover asset URL resolution, CSS host isolation, and resource teardown. The standalone source and deployment are not edited.

Run browser QA with `node scripts/showroom-integration-qa.mjs` and `node scripts/showroom-extended-qa.mjs` while serving `dist/` on port 4180. These scripts require the existing local Playwright installation, Chrome, and network access for the parent's established CDN dependencies. QA captures/results stay under `scripts/` and are excluded from production.

## Logo sizing

Adjust logo dimensions in **`index.html`** on each `<img>` in the Organizations grid (Tailwind classes like `max-h-28`, `max-w-[260px]`), matching the intent of the old `partners` array in React.
