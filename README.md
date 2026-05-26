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
- GitHub Pages
