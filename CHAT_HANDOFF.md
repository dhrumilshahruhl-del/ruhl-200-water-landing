# Handoff — ruhl-200-water-landing

## Repo
- GitHub: `dhrumilshahruhl-del/ruhl-200-water-landing`
- Local: `d:\RUHL realm\RUHL May 2026\Prototype\ruhl-200-water-landing`
- Stack: static `index.html` + Tailwind CDN + `styles.css` + `main.js` (no build)
- Pages URL: `https://dhrumilshahruhl-del.github.io/ruhl-200-water-landing/`

## Git
- Remote: `git@github-ruhl:dhrumilshahruhl-del/ruhl-200-water-landing.git`
- SSH: `Host github-ruhl` → `~/.ssh/id_ed25519_ruhl` (account `dhrumilshahruhl-del`; other repos use `Dhrumil-Shah-UX`)
- Branch: `main` @ `e97db03` — synced with `origin/main`, clean
- `gh` CLI not installed

## Done (on main)
- Orgs: removed Swegon/dena/GES logo cards → `dena_logo.png` + 3 text cards + full-width mobile “Learn more” buttons
- Removed all `$` stats/cards; NYSERDA subtitle without dollar amount
- Responsive: desktop unchanged @ 1024px+; tablet/mobile via `styles.css` + `lg:` in HTML
- Mobile (≤767px): gutters `0.5rem`; org logo cards fixed (`.org-partner-grid`); CO₂ chart 490×310 scroll; waterfall 560×255 (0.5× scale) scroll
- `main.js`: scroll-triggered chart/reveal tweaks for mobile/tablet
- Implementation H2: “Roadmap to Net Zero”

## Open
- **Pages deploy queued:** Settings → Pages → deploy **`main`** / **`/(root)`** (not Actions, not feature branch)

## Not built
- GSAP building scroll in `#solution` — discussed only; have 2D PNG (not 3D); CSS hooks `.building-scene` exist

## Key files
`index.html`, `styles.css`, `main.js`, `logos/dena_logo.png`

## Rules
- Don’t commit/push unless asked; preserve desktop @ 1024px+; don’t redesign unless asked
