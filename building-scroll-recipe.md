# 200 Water — Building Scroll Animation Recipe

Paste this file into a new chat to rebuild the full GSAP + Three.js building scroll (orbit → rooftop → roof-only crossfade).

---

## Assets & HTML

```html
<section
  id="building-scroll"
  class="building-scroll-section"
  data-model-path="./logos/200_water.glb"
  data-roof-model-path="./logos/200 water Roof Only.glb"
>
  <div class="building-scroll-sticky">
    <canvas id="building-scroll-canvas"></canvas>
  </div>
</section>
<script type="module" src="./building-scroll.js"></script>
```

| File | Source | Notes |
|------|--------|-------|
| `logos/200_water.glb` | Blender export | Full building (~41 MB). Scene root bbox roughly `[-29.6, -117, -65.6]` → `[45, 13.1, 5]` |
| `logos/200 water Roof Only.glb` | Three.js GLTFExporter | Roof only (~20 MB). Bbox roughly `[-20.8, -0.35, -61.4]` → `[41.8, 13.1, 0.6]`. **Same max Y (13.095)** as full building; different X/Z — do not assume shared origin |

Requires a local web server (GLB will not load from `file://`).

---

## CSS

```css
.building-scroll-section {
  height: 380vh;
  background: linear-gradient(180deg, #dce6ee 0%, #eef2f5 46%, #f7f8f8 100%);
}
.building-scroll-sticky {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}
```

ScrollTrigger: `trigger: section`, `start: 'top top'`, `end: 'bottom bottom'`, `pin: sticky`.

---

## Stack

- **Three.js** (module import + `GLTFLoader`)
- **GSAP + ScrollTrigger** (global on `window`)
- Main logic: `building-scroll.js`
- No procedural rooftop overlay (`rooftop-retrofit.js` not used)

---

## Scene defaults

```js
camera: PerspectiveCamera(42, aspect, 0.1, 500)
camera.up.set(0, 1, 0)   // always upright — no vertical flip

state.startFov = 42
state.midFov   = 38
state.endFov   = 32
state.rooftopInspectFov = Math.max(29, state.endFov - 3)  // = 29 at end frame

ambient: 0xffffff @ 0.85
key:     (6, 12, 8)   @ 1.35
fill:    (-8, 4, -6)  @ 0.75  color 0xdce8f5
rim:     (0, 8, -10)  @ 0.45

sky/fog: canvas gradient #dce6ee → #eef2f5 → #f7f8f8, fog color 0xf7f8f8
```

Playhead smoothing: lerp `(targetProgress - playhead) * 0.1`; near end (`> 0.9`) use `0.22`.

---

## Model fit pipeline (`fitModel`)

Apply to **full building only**. Store result in `state.buildingFit` for roof-only replay.

```
1. box = AABB of raw GLB scene
2. initialCenter = box.getCenter()
3. object.position.sub(initialCenter)

4. fitScale = targetSize / max(size.x, size.y, size.z)
   targetSize = 8.5 desktop | 7.5 mobile (≤767px)
5. object.scale.setScalar(fitScale)

6. fittedCenter = new AABB center after scale
7. object.position.sub(fittedCenter)

8. if fittedSize.z > fittedSize.x → object.rotation.y = π/2

9. snapRooftopLongEdgeHorizontal() → then object.rotation.y += π
   (opposite long facade horizontal / parallel to screen bottom)

10. state.buildingFit = { initialCenter, fittedCenter, fitScale, finalRotationY }
```

### Rooftop long-edge snap (`snapRooftopLongEdgeHorizontal`)

- Cache roof vertices (`roofVertexCache`): sample ~1200 verts/object-local, keep top **18%** by Y (`roofBandMin = min.y + height * 0.82`)
- PCA footprint angle → coarse rotation search (72 steps) + fine search (±120/1200 rad)
- Measure tilt of long footprint edges projected on **rooftop align camera**; pick minimum tilt
- Final rotation: `bestRotation + Math.PI`

---

## Orbit (phase 1)

Orbit rig: spherical coords around `focus`.

```js
focus = (0, fittedSize.y * 0.115, 0)

orbitSpan      = 38°
endAzimuth     = 0.38 rad
startAzimuth   = endAzimuth - orbitSpan
startElevation = 0.32
endElevation   = 0.17

orbitDistance  = getCameraDistance(sphere.radius, startFov, aspect, padding 1.22)
startRadius    = orbitDistance * 1.18
endRadius      = orbitDistance * 0.68

entryAzimuth   = lerp(start, end, 0.025)   // soft scroll-in
entryElevation = lerp(start, end, 0.02)
entryRadius    = lerp(start, end, 0.015)
```

Phase 1 tweens (duration `0.035*L` entry, then `ORBIT_SPIN_FRACTION*L` orbit):
- `orbitRig` → entry, then → end azimuth/elevation/radius
- `camera.fov` → `midFov` (38)
- Light rig nudge on key/fill

---

## End-frame rooftop camera (`buildRooftopCameraVectors`)

**Critical:** use `state.rooftopInspectFov` (29), not `endFov`.

```js
ROOFTOP_END_FIT_MARGIN      = 0.72
ROOFTOP_END_DISTANCE_SCALE  = 0.96
pitchDown                   = 52°

roofBox    = getRooftopMeshBounds(object)   // top 18% verts, world AABB
roofCenter = roofBox.getCenter()
roofSize   = roofBox.getSize()
roofSpan   = max(roofSize.x, roofSize.z, roofSize.y * 0.5)

compositionLift = roofSize.y * (0.10 desktop | 0.08 mobile)
lookTarget.y    = roofCenter.y - roofSize.y * 0.12 + compositionLift

horizontalDist  = roofSpan * (1.0 desktop | 0.92 mobile)
// iterate up to 18× until projected frame corners fit margin 0.72 NDC
horizontalDist *= ROOFTOP_END_DISTANCE_SCALE

camera from +Z:
  pos.x = look.x
  pos.y = look.y + horizontalDist * tan(52°)
  pos.z = look.z + horizontalDist
```

Store as `state.roofPos`, `state.roofLook`. Phase 3 tweens `camPos`/`camLook`/`fov` here.

### Frame points (for fit & alignment)

3 Y-levels per rooftop AABB: `max.y`, `max.y - 35% height`, `max.y - 70% height` × 4 corners = 12 points.

---

## Scroll timeline (GSAP, `L = 0.36`)

| Phase | Label | Fraction of L | Scroll % | Action |
|-------|-------|---------------|----------|--------|
| 1 | `phase1` | 0 → 0.20 | 0–20% | Entry + 38° orbit, FOV → 38 |
| 3 | `phase3` @ `orbitEnd` | 0.20 → 0.34 | 20–34% | Camera → `roofPos`/`roofLook`, FOV → 29 |
| 4 | `phase4` @ `rooftopEnd` | 0.34 → 0.348 | 34–35% | Crossfade building → roof-only (`ease: 'none'`) |
| 5 | `phase5` @ `swapEnd` | 0.348 → 1.0 | 35–100% | **Dwell** — pinned on roof-only, camera frozen |

```js
LEGACY_TIMELINE_END        = 0.36
ORBIT_SPIN_FRACTION        = 0.20
ROOFTOP_APPROACH_FRACTION  = 0.14
ROOF_SWAP_FRACTION         = 0.008
ROOF_DWELL_FRACTION        = 1 - 0.20 - 0.14 - 0.008  // ≈ 0.652
```

Phase 5 is an empty tween `{ duration: ROOF_DWELL_FRACTION * L }` so swap finishes **while pinned**, not at unpin.

Side-story UI fades out scroll 5–10% (`SIDE_STORY_FADE_START/END`).

---

## Roof-only alignment (`alignRoofOnlyModel`)

Roof GLB has different export coords → **two-step align**:

### Step A — Replay building fit

```js
roofOnly.reset()
roofOnly.position.sub(buildingFit.initialCenter)
roofOnly.scale.setScalar(buildingFit.fitScale)
roofOnly.position.sub(buildingFit.fittedCenter)
roofOnly.rotation.y = buildingFit.finalRotationY
```

### Step B — Screen-space snap (`snapRoofOnlyToRooftopScreen`)

Use end camera (`state.roofPos`, `state.roofLook`, `rooftopInspectFov`):

1. **Position pass:** project vertex samples → match screen center (cx, cy) via NDC unproject translation. Building samples = rooftop-band verts; roof-only = all mesh verts (~1500 budget).

2. **Size pass:** iterate uniform scale around roof pivot; `scaleFix = sqrt(wRatio * hRatio)` until projected width & height within 0.08% of building rooftop. Re-center after each scale step.

Crossfade: `rooftopSwap.progress` 0→1, building opacity `1-t`, roof-only opacity `t`. Building hidden at `t ≥ 0.999`.

---

## Do NOT regress

- No vertical flip (`camera.up` always `(0,1,0)`)
- No `setViewOffset` for layout (distorts building)
- No per-axis scale skew on roof-only (use uniform scale only)
- No procedural pipes/labels on rooftop
- No `lateralOffset` on roof look/pos
- Cache `roofVertexCache` during snap — don't rescan GLB every step
- Build rooftop camera with **`rooftopInspectFov`**, not raw `endFov`
- `snapRooftopLongEdgeHorizontal` must end with **`+ Math.PI`** (opposite facade horizontal)

---

## File map

| File | Role |
|------|------|
| `building-scroll.js` | All Three.js + GSAP logic |
| `index.html` | Section markup + model paths |
| `styles.css` | `380vh` section, sticky viewport |
| `.cursor/rules/building-scroll-end-frame.mdc` | Cursor rule shorthand (may lag this recipe) |

---

## Quick rebuild checklist

1. Section 380vh + pinned sticky canvas
2. Load `200_water.glb` → `fitModel` → store `buildingFit`
3. Compute orbit + `buildRooftopCameraVectors` at FOV 29
4. GSAP timeline: orbit (20%) → rooftop approach (14%) → roof swap (0.8%) → dwell (65%)
5. Load `200 water Roof Only.glb` → replay fit → screen-space position + size snap
6. Crossfade at phase 4; hold roof-only through phase 5 before section unpins
