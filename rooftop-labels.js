import * as THREE from 'three';

/** Set to `true` when manual label/arrow layout editing is needed again. */
export const ROOF_LABEL_LAYOUT_EDITING_ENABLED = false;

/** Set to `true` to drag flow waypoints in 3D and export paths for baking. Editor UI stays in code when false. */
export const ROOF_FLOW_LAYOUT_EDITING_ENABLED = false;

/** Baked 3D flow paths — updated after flow layout review. */
export const ROOF_FLOW_LAYOUT_DEFAULT = {
  'exhaust-left': {
    waypoints: [
      { local: { x: -3.213495367952028, y: 4.928562497168727, z: -26.909992342151767 } },
      { local: { x: -6.1303615971402134, y: 5.919297593593619, z: -24.152364425448184 } },
      { local: { x: -19.95007287847266, y: 5.4529998310203, z: -11.054420046431819 } },
    ],
  },
  'exhaust-right': {
    waypoints: [
      { local: { x: 22.542653936544085, y: 5.054434861523099, z: -54.075169897262214 } },
      { local: { x: 12.064479402074777, y: 5.532447765237812, z: -43.02454286723275 } },
      { local: { x: 8.604083464293598, y: 5.88109169739915, z: -46.381867977327786 } },
    ],
  },
  'supply-left': {
    waypoints: [
      { local: { x: 0.7017435913895973, y: 13.624491031499687, z: -34.915554706723206 } },
      { local: { x: 3.7721412484464416, y: 12.945989904734112, z: -31.842990630657972 } },
      { local: { x: 5.27110147739031, y: 11.535728621991332, z: -30.653629340699283 } },
      { local: { x: 7.251368045806885, y: 11.812951087951639, z: -30.935245513916016 } },
      { local: { x: 8.30465697612317, y: 11.37970056570878, z: -31.144846774194846 } },
      { local: { x: 8.3571369190621, y: 11.518596561800166, z: -31.091692464108988 } },
      { local: { x: 8.434295372514761, y: 11.502839781971126, z: -31.185803818326605 } },
      { local: { x: 8.315365115413154, y: 11.51308569767557, z: -31.13492716346179 } },
      { local: { x: 9.274511779484612, y: 11.269814952957077, z: -30.023534038546515 } },
    ],
  },
  'supply-right': {
    waypoints: [
      { local: { x: 6.765440588834629, y: 14.79507071391069, z: -39.317886241950646 } },
      { local: { x: 8.669053021995694, y: 13.087171786376715, z: -37.61148798236478 } },
      { local: { x: 10.01324371938183, y: 12.681676639741369, z: -36.219611851542425 } },
      { local: { x: 10.891546388703688, y: 12.03638207651322, z: -35.2863553615888 } },
      { local: { x: 8.854726361697267, y: 12.408412465712203, z: -31.854443714610916 } },
      { local: { x: 8.721558265484418, y: 11.96053187503081, z: -30.717981134015993 } },
    ],
  },
};

/** Baked default offsets — updated after layout review. */
export const ROOF_LABEL_LAYOUT_DEFAULT = {
  'corridor-supply': {
    label: { ox: -78.6666259765625, oy: -0.0000152587890625 },
    anchors: [
      { local: { x: 2.167852360844492, y: 12.202641542442073, z: -33.79941000411749 } },
      { local: { x: 7.91483120846209, y: 13.199027319310261, z: -37.59056258081317 } },
    ],
  },
  'supply-building': {
    label: { ox: 165.33343505859375, oy: -70.66665649414062 },
    anchors: [{ local: { x: 10.954456439621474, y: 12.463044576512019, z: -33.742136187305945 } }],
  },
  'building-exhaust-left': {
    label: { ox: -30.00006103515625, oy: -40.000030517578125 },
    anchors: [{ local: { x: -11.20152234487707, y: 5.478200351526489, z: -20.247579233711484 } }],
  },
  'building-exhaust-right': {
    label: { ox: 143.333251953125, oy: -34.66668701171875 },
    anchors: [{ local: { x: 19.070503992647193, y: 4.983383348576631, z: -50.630394348745746 } }],
  },
  'ehr-left': {
    label: { ox: -340.6666564941406, oy: -12.666656494140625 },
    anchors: [{ local: { x: -16.77597413791065, y: 5.896447588975158, z: -13.935944463922763 } }],
  },
  'ehr-right': {
    label: { ox: 119.33349609375, oy: 29.333343505859375 },
    anchors: [{ local: { x: 13.10971116671438, y: 5.676325814594926, z: -44.278417421903725 } }],
  },
  'exhaust-air-left': {
    label: { ox: -368.6666564941406, oy: -38 },
    anchors: [{ local: { x: -18.215067418328157, y: 5.2965278470271215, z: -12.435828003845383 } }],
  },
  'exhaust-air-right': {
    label: { ox: 0.6666259765625, oy: -72.6666259765625 },
    anchors: [{}],
  },
};

const LAYOUT_STORAGE_KEY = 'ruhl-200-roof-label-layout';
const FLOW_LAYOUT_STORAGE_KEY = 'ruhl-200-roof-flow-layout';

/** Callout specs aligned to the annotated reference diagram (8 labels, 9 arrows). */
const ROOF_CALLOUT_SPECS = [
  {
    id: 'corridor-supply',
    title: 'Corridor HVAC Supply Units',
    body: '',
    swatch: '#66ff33',
    placement: 'center-top',
    multiAnchor: true,
    hexes: ['66ff33', '99ff99'],
    anchorMode: 'per-hex-top',
  },
  {
    id: 'supply-building',
    title: 'Supply to the Building',
    body: '',
    swatch: '#ff00ff',
    placement: 'center-top',
    hexes: ['ff00ff'],
    anchorMode: 'top-center',
  },
  {
    id: 'building-exhaust-left',
    title: 'Building Exhaust Toilet Kitchen',
    body: '',
    swatch: '#fdc644',
    placement: 'left',
    hexes: ['fdc644', 'ff8000'],
    anchorMode: 'wing-mid-left',
  },
  {
    id: 'building-exhaust-right',
    title: 'Building Exhaust Toilet Kitchen',
    body: '',
    swatch: '#fdc644',
    placement: 'right',
    hexes: ['fdc644', 'ff8000'],
    anchorMode: 'wing-mid-right',
  },
  {
    id: 'ehr-left',
    title: 'Exhaust Heat Recovery Unit',
    body: '',
    swatch: '#808080',
    placement: 'left',
    hexes: ['808080', 'ababab'],
    anchorMode: 'cluster-left',
  },
  {
    id: 'ehr-right',
    title: 'Exhaust Heat Recovery Unit',
    body: '',
    swatch: '#808080',
    placement: 'right',
    hexes: ['808080', 'ababab'],
    anchorMode: 'cluster-right',
  },
  {
    id: 'exhaust-air-left',
    title: 'Exhaust Air',
    body: '',
    swatch: '#993300',
    placement: 'left',
    hexes: ['bdbbbb'],
    anchorMode: 'top-center',
  },
  {
    id: 'exhaust-air-right',
    title: 'Exhaust Air',
    body: '',
    swatch: '#993300',
    placement: 'right',
    hexes: ['993300', 'ff0000'],
    anchorMode: 'compact-right',
  },
];

export const ROOF_LEGEND_ITEMS = [
  { swatch: '#808080', label: 'Exhaust heat recovery unit' },
  { swatch: '#fdc644', label: 'Building exhaust (toilet / kitchen)' },
  { swatch: '#ff00ff', label: 'Supply to the building' },
  { swatch: '#66ff33', label: 'Fresh air intake' },
  { swatch: '#993300', label: 'Exhaust air outlet' },
];

const FLOW_COLORS = {
  exhaust: '#e53935',
  supply: '#66ff33',
};

const SUPPLY_GEOMETRY_HEXES = ['66ff33', '99ff99', 'ff00ff'];

/** Screen-space flow paths drawn between resolved rooftop anchor points. */
const ROOF_FLOW_SEQUENCES = [
  {
    id: 'exhaust-left',
    kind: 'exhaust',
    waypoints: [
      { calloutId: 'building-exhaust-left', anchorIndex: 0 },
      { calloutId: 'ehr-left', anchorIndex: 0 },
      { calloutId: 'exhaust-air-left', anchorIndex: 0 },
    ],
  },
  {
    id: 'exhaust-right',
    kind: 'exhaust',
    waypoints: [
      { calloutId: 'building-exhaust-right', anchorIndex: 0 },
      { calloutId: 'ehr-right', anchorIndex: 0 },
      { calloutId: 'exhaust-air-right', anchorIndex: 0 },
    ],
  },
  {
    id: 'supply-left',
    kind: 'supply',
    routeMode: 'supply-geometry',
    start: { calloutId: 'corridor-supply', anchorIndex: 0 },
    end: { calloutId: 'supply-building', anchorIndex: 0 },
  },
  {
    id: 'supply-right',
    kind: 'supply',
    routeMode: 'supply-geometry',
    start: { calloutId: 'corridor-supply', anchorIndex: 1 },
    end: { calloutId: 'supply-building', anchorIndex: 0 },
  },
];

const worldPoint = new THREE.Vector3();
const projected = new THREE.Vector3();
const vertex = new THREE.Vector3();
const ndcPoint = new THREE.Vector3();
const localAnchorPoint = new THREE.Vector3();

function readMeshHex(mesh) {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!material?.color) return null;
  return material.color.getHexString().toLowerCase();
}

function dedupeMeshes(meshes) {
  const seen = new Set();
  return meshes.filter((mesh) => {
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const key = [
      readMeshHex(mesh),
      center.x.toFixed(2),
      center.y.toFixed(2),
      center.z.toFixed(2),
      size.x.toFixed(2),
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sampleMeshVerticesWorld(mesh, strideBudget = 1400) {
  const positions = mesh.geometry?.attributes?.position;
  if (!positions) return [];

  mesh.updateWorldMatrix(true, false);
  const stride = Math.max(1, Math.floor(positions.count / strideBudget));
  const samples = [];

  for (let i = 0; i < positions.count; i += stride) {
    vertex.fromBufferAttribute(positions, i);
    mesh.localToWorld(vertex);
    samples.push(vertex.clone());
  }

  return samples;
}

function topSurfaceCenter(vertices, topFraction = 0.16) {
  if (!vertices.length) return null;

  let maxY = -Infinity;
  let minY = Infinity;
  vertices.forEach((point) => {
    maxY = Math.max(maxY, point.y);
    minY = Math.min(minY, point.y);
  });

  const bandMin = maxY - Math.max(maxY - minY, 0.001) * topFraction;
  const band = vertices.filter((point) => point.y >= bandMin);
  const pool = band.length ? band : vertices;
  const center = new THREE.Vector3();
  pool.forEach((point) => center.add(point));
  return center.multiplyScalar(1 / pool.length);
}

function medianComponent(vertices, axisIndex) {
  const values = vertices.map((point) => point.getComponent(axisIndex)).sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)] ?? 0;
}

function collectVerticesForHexes(roofOnly, hexes) {
  const wanted = new Set(hexes);
  const meshes = [];
  roofOnly.traverse((node) => {
    if (node.isMesh && wanted.has(readMeshHex(node))) meshes.push(node);
  });

  const vertices = [];
  dedupeMeshes(meshes).forEach((mesh) => {
    vertices.push(...sampleMeshVerticesWorld(mesh));
  });
  return vertices;
}

function wingMidAnchor(vertices, side) {
  if (!vertices.length) return null;
  const medianX = medianComponent(vertices, 0);
  const wing = vertices.filter((point) => (side === 'left' ? point.x <= medianX : point.x > medianX));
  if (!wing.length) return null;

  const minX = Math.min(...wing.map((p) => p.x));
  const maxX = Math.max(...wing.map((p) => p.x));
  const midBand = wing.filter((point) => {
    const t = (point.x - minX) / Math.max(maxX - minX, 0.001);
    return t > 0.28 && t < 0.72;
  });

  return topSurfaceCenter(midBand.length ? midBand : wing);
}

function clusterSideAnchor(vertices, side) {
  if (!vertices.length) return null;
  const medianX = medianComponent(vertices, 0);
  const slice = vertices.filter((point) => (side === 'left' ? point.x <= medianX : point.x > medianX));
  return topSurfaceCenter(slice.length ? slice : vertices);
}

function compactSideAnchor(vertices, side) {
  if (!vertices.length) return null;
  const sorted = [...vertices].sort((a, b) => a.x - b.x);
  const slice =
    side === 'left'
      ? sorted.slice(0, Math.max(4, Math.floor(sorted.length * 0.22)))
      : sorted.slice(Math.floor(sorted.length * 0.78));
  return topSurfaceCenter(slice);
}

function perHexTopAnchors(roofOnly, hexes) {
  const anchors = [];
  hexes.forEach((hex) => {
    const meshes = [];
    roofOnly.traverse((node) => {
      if (node.isMesh && readMeshHex(node) === hex) meshes.push(node);
    });
    dedupeMeshes(meshes).forEach((mesh) => {
      const center = topSurfaceCenter(sampleMeshVerticesWorld(mesh));
      if (center) anchors.push(center);
    });
  });

  anchors.sort((a, b) => a.x - b.x);
  return anchors;
}

function resolveCalloutAnchors(spec, roofOnly) {
  const vertices = collectVerticesForHexes(roofOnly, spec.hexes);

  switch (spec.anchorMode) {
    case 'per-hex-top':
      return perHexTopAnchors(roofOnly, spec.hexes);
    case 'top-center': {
      const center = topSurfaceCenter(vertices);
      return center ? [center] : [];
    }
    case 'wing-mid-left': {
      const anchor = wingMidAnchor(vertices, 'left');
      return anchor ? [anchor] : [];
    }
    case 'wing-mid-right': {
      const anchor = wingMidAnchor(vertices, 'right');
      return anchor ? [anchor] : [];
    }
    case 'cluster-left': {
      const anchor = clusterSideAnchor(vertices, 'left');
      return anchor ? [anchor] : [];
    }
    case 'cluster-right': {
      const anchor = clusterSideAnchor(vertices, 'right');
      return anchor ? [anchor] : [];
    }
    case 'compact-left': {
      const anchor = compactSideAnchor(vertices, 'left');
      return anchor ? [anchor] : [];
    }
    case 'compact-right': {
      const anchor = compactSideAnchor(vertices, 'right');
      return anchor ? [anchor] : [];
    }
    default:
      return [];
  }
}

export function discoverRoofLabelCallouts(roofOnly) {
  if (!roofOnly) return [];

  roofOnly.updateMatrixWorld(true);

  return ROOF_CALLOUT_SPECS.flatMap((spec) => {
    const worldAnchors = resolveCalloutAnchors(spec, roofOnly);
    if (!worldAnchors.length) return [];

    return [
      {
        ...spec,
        localPoints: worldAnchors.map((point) => roofOnly.worldToLocal(point.clone())),
      },
    ];
  });
}

function placementOffset(placement, anchorScreen, rect, anchorScreens = []) {
  if (placement === 'left') {
    return { ox: -118, oy: -8 };
  }
  if (placement === 'right') {
    return { ox: 118, oy: -8 };
  }

  if (placement === 'center-top') {
    if (anchorScreens.length > 1) {
      const cx = anchorScreens.reduce((sum, point) => sum + point.x, 0) / anchorScreens.length;
      const cy = anchorScreens.reduce((sum, point) => sum + point.y, 0) / anchorScreens.length;
      return { ox: cx - anchorScreen.x, oy: cy - anchorScreen.y - 72 };
    }
    return { ox: 0, oy: -88 };
  }

  const nx = (anchorScreen.x / rect.width) * 2 - 1;
  const ny = (anchorScreen.y / rect.height) * 2 - 1;
  return { ox: nx * 72, oy: -ny * 72 - 36 };
}

function cloneOffset(offset = { ox: 0, oy: 0 }) {
  return { ox: offset.ox ?? 0, oy: offset.oy ?? 0 };
}

function cloneLocal(local) {
  if (!local) return null;
  return { x: local.x, y: local.y, z: local.z };
}

function mergeAnchorEntry(base = {}, override = {}) {
  if (override.local) return { local: cloneLocal(override.local) };
  if (base.local && override.ox == null && override.oy == null) {
    return { local: cloneLocal(base.local) };
  }
  return {
    ox: override.ox ?? base.ox ?? 0,
    oy: override.oy ?? base.oy ?? 0,
    local: cloneLocal(override.local ?? base.local),
  };
}

function mergeLayoutEntry(base = {}, override = {}) {
  const anchorCount = Math.max(base.anchors?.length ?? 0, override.anchors?.length ?? 0);
  const anchors = [];
  for (let i = 0; i < anchorCount; i += 1) {
    anchors.push(mergeAnchorEntry(base.anchors?.[i], override.anchors?.[i]));
  }
  return {
    label: cloneOffset({ ...base.label, ...override.label }),
    anchors,
  };
}

function projectLocalToScreen(localPoint, roofOnly, camera, rect) {
  worldPoint.copy(localPoint);
  roofOnly.localToWorld(worldPoint);
  projected.copy(worldPoint).project(camera);
  return {
    x: (projected.x * 0.5 + 0.5) * rect.width,
    y: (-projected.y * 0.5 + 0.5) * rect.height,
    visible: projected.z < 1,
    depthNdc: projected.z,
  };
}

function pointsToPathD(points) {
  if (points.length < 2) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

function collectLocalTopVertices(roofOnly, hexes, topBandWorld = 1.35) {
  const worldVertices = collectVerticesForHexes(roofOnly, hexes);
  if (!worldVertices.length) return [];

  let maxY = -Infinity;
  worldVertices.forEach((point) => {
    maxY = Math.max(maxY, point.y);
  });

  const bandMin = maxY - topBandWorld;
  return worldVertices
    .filter((point) => point.y >= bandMin)
    .map((point) => roofOnly.worldToLocal(point.clone()));
}

function appendIfDistinct(path, point, minDistance = 0.35) {
  const last = path[path.length - 1];
  if (!last || last.distanceTo(point) >= minDistance) path.push(point.clone());
}

function buildSupplyGeometryPath(roofOnly, startLocal, endLocal) {
  const pool = collectLocalTopVertices(roofOnly, SUPPLY_GEOMETRY_HEXES);
  const minX = Math.min(startLocal.x, endLocal.x) - 3.5;
  const maxX = Math.max(startLocal.x, endLocal.x) + 3.5;
  const minZ = Math.min(startLocal.z, endLocal.z) - 3.5;
  const maxZ = Math.max(startLocal.z, endLocal.z) + 3.5;

  const routePool = pool.filter(
    (point) => point.x >= minX && point.x <= maxX && point.z >= minZ && point.z <= maxZ
  );
  const candidates = routePool.length >= 8 ? routePool : pool;

  const path = [startLocal.clone()];
  let current = startLocal.clone();
  const used = new Set();

  for (let step = 0; step < 14; step += 1) {
    if (current.distanceTo(endLocal) < 0.55) break;

    let bestIndex = -1;
    let bestScore = Infinity;
    candidates.forEach((candidate, index) => {
      if (used.has(index)) return;

      const toEnd = candidate.distanceTo(endLocal);
      const fromCurrent = candidate.distanceTo(current);
      const progress = current.distanceTo(endLocal) - toEnd;
      if (progress < 0.1) return;

      const score = fromCurrent * 0.82 + toEnd * 0.52;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex < 0) break;
    used.add(bestIndex);
    current = candidates[bestIndex];
    appendIfDistinct(path, current, 0.38);
  }

  appendIfDistinct(path, endLocal, 0.38);
  return path;
}

function localPathFromWaypoints(waypoints = []) {
  return waypoints.map(
    (waypoint) => new THREE.Vector3(waypoint.local.x, waypoint.local.y, waypoint.local.z)
  );
}

function waypointsFromLocalPath(localPath) {
  return localPath.map((point) => ({
    local: { x: point.x, y: point.y, z: point.z },
  }));
}

function computeAutoFlowLocalPath(sequence, roofOnly, anchorCaches) {
  if (sequence.routeMode === 'supply-geometry') {
    const startLocal = anchorCaches.local.get(
      `${sequence.start.calloutId}:${sequence.start.anchorIndex}`
    );
    const endLocal = anchorCaches.local.get(`${sequence.end.calloutId}:${sequence.end.anchorIndex}`);
    if (!startLocal || !endLocal) return [];
    return buildSupplyGeometryPath(roofOnly, startLocal, endLocal);
  }

  return sequence.waypoints
    .map((waypoint) => anchorCaches.local.get(`${waypoint.calloutId}:${waypoint.anchorIndex}`))
    .filter(Boolean)
    .map((point) => point.clone());
}

function loadFlowLayoutState() {
  const merged = {};

  Object.entries(ROOF_FLOW_LAYOUT_DEFAULT).forEach(([id, entry]) => {
    merged[id] = {
      waypoints: (entry.waypoints ?? []).map((waypoint) => ({
        local: cloneLocal(waypoint.local),
      })),
    };
  });

  if (!ROOF_FLOW_LAYOUT_EDITING_ENABLED) return merged;

  try {
    const stored = localStorage.getItem(FLOW_LAYOUT_STORAGE_KEY);
    if (!stored) return merged;

    const parsed = JSON.parse(stored);
    Object.entries(parsed).forEach(([id, entry]) => {
      merged[id] = {
        waypoints: (entry.waypoints ?? []).map((waypoint) => ({
          local: cloneLocal(waypoint.local),
        })),
      };
    });
  } catch {
    // Ignore invalid saved flow layout.
  }

  return merged;
}

function persistFlowLayoutState(flowLayoutState) {
  try {
    localStorage.setItem(FLOW_LAYOUT_STORAGE_KEY, JSON.stringify(flowLayoutState));
  } catch {
    // Ignore quota / privacy errors.
  }
}

function distancePointToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 0.001) {
    return {
      distance: Math.hypot(point.x - start.x, point.y - start.y),
      t: 0,
      x: start.x,
      y: start.y,
    };
  }

  let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const projX = start.x + t * dx;
  const projY = start.y + t * dy;
  return {
    distance: Math.hypot(point.x - projX, point.y - projY),
    t,
    x: projX,
    y: projY,
  };
}

function screenOffsetToLocalAnchor(baseLocal, screenOffset, roofOnly, camera, rect) {
  worldPoint.copy(baseLocal);
  roofOnly.localToWorld(worldPoint);
  projected.copy(worldPoint).project(camera);

  const screenX = (projected.x * 0.5 + 0.5) * rect.width + (screenOffset.ox ?? 0);
  const screenY = (-projected.y * 0.5 + 0.5) * rect.height + (screenOffset.oy ?? 0);

  ndcPoint.set(
    (screenX / rect.width) * 2 - 1,
    -(screenY / rect.height) * 2 + 1,
    projected.z
  );
  ndcPoint.unproject(camera);
  return roofOnly.worldToLocal(ndcPoint);
}

function screenPointToLocalAnchor(screenX, screenY, referenceLocal, roofOnly, camera, rect) {
  worldPoint.copy(referenceLocal);
  roofOnly.localToWorld(worldPoint);
  projected.copy(worldPoint).project(camera);

  ndcPoint.set(
    (screenX / rect.width) * 2 - 1,
    -(screenY / rect.height) * 2 + 1,
    projected.z
  );
  ndcPoint.unproject(camera);
  return roofOnly.worldToLocal(ndcPoint);
}

function resolveAnchorLocal(spec, layout, index, roofOnly, camera, rect, target) {
  const entry = layout.anchors[index] ?? {};
  if (entry.local) {
    return target.set(entry.local.x, entry.local.y, entry.local.z);
  }
  if ((entry.ox ?? 0) !== 0 || (entry.oy ?? 0) !== 0) {
    const migrated = screenOffsetToLocalAnchor(spec.localPoints[index], entry, roofOnly, camera, rect);
    layout.anchors[index] = {
      local: { x: migrated.x, y: migrated.y, z: migrated.z },
    };
    return target.copy(migrated);
  }
  return target.copy(spec.localPoints[index]);
}

function loadLayoutState() {
  const merged = {};

  Object.entries(ROOF_LABEL_LAYOUT_DEFAULT).forEach(([id, entry]) => {
    merged[id] = mergeLayoutEntry({}, entry);
  });

  if (!ROOF_LABEL_LAYOUT_EDITING_ENABLED) return merged;

  try {
    const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!stored) return merged;

    const parsed = JSON.parse(stored);
    Object.entries(parsed).forEach(([id, entry]) => {
      merged[id] = mergeLayoutEntry(merged[id], entry);
    });
  } catch {
    // Ignore invalid saved layout.
  }

  return merged;
}

function persistLayoutState(layoutState) {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutState));
  } catch {
    // Ignore quota / privacy errors.
  }
}

function measureCalloutCardSize(callout, card) {
  return {
    width: card.offsetWidth || callout.offsetWidth || 0,
    height: card.offsetHeight || callout.offsetHeight || 0,
  };
}

/** Leader attach on card bottom edge; callout uses translate(-50%, -100%) on (labelX, labelY). */
function leaderAttachFromLabel(labelX, labelY, cardSize) {
  return {
    x: labelX,
    y: labelY - cardSize.height * 0.12,
  };
}

export function createRooftopLabels({ host, camera, getRoofOnly, getAlpha }) {
  const layoutEditingEnabled = ROOF_LABEL_LAYOUT_EDITING_ENABLED;
  const flowEditingEnabled = ROOF_FLOW_LAYOUT_EDITING_ENABLED;

  const leaderSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  leaderSvg.setAttribute('class', 'rooftop-label-leaders');
  leaderSvg.setAttribute('aria-hidden', 'true');

  const flowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  flowSvg.setAttribute('class', 'rooftop-flow-paths');
  flowSvg.setAttribute('aria-hidden', 'true');

  const flowWaypointLayer = flowEditingEnabled ? document.createElement('div') : null;
  if (flowWaypointLayer) {
    flowWaypointLayer.className = 'rooftop-flow-waypoint-layer';
    flowWaypointLayer.setAttribute('aria-hidden', 'true');
  }

  const layer = document.createElement('div');
  layer.className = 'rooftop-label-layer';
  layer.id = 'building-rooftop-labels';
  layer.setAttribute('aria-hidden', 'true');

  const anchorLayer = layoutEditingEnabled ? document.createElement('div') : null;
  if (anchorLayer) {
    anchorLayer.className = 'rooftop-label-anchor-layer';
    anchorLayer.setAttribute('aria-hidden', 'true');
  }

  const toolbar = layoutEditingEnabled ? document.createElement('div') : null;
  let toolbarStatus = null;
  if (toolbar) {
    toolbar.className = 'rooftop-label-layout-toolbar';
    toolbar.innerHTML = `
      <p class="rooftop-label-layout-toolbar-title">Label layout editor</p>
      <p class="rooftop-label-layout-toolbar-copy">Drag label cards to move callouts. Drag white dots to move arrow tips.</p>
      <div class="rooftop-label-layout-toolbar-actions">
        <button type="button" class="rooftop-label-layout-btn" data-action="copy">Copy layout JSON</button>
        <button type="button" class="rooftop-label-layout-btn is-muted" data-action="reset">Reset layout</button>
      </div>
      <p class="rooftop-label-layout-toolbar-status" aria-live="polite"></p>
    `;
    toolbarStatus = toolbar.querySelector('.rooftop-label-layout-toolbar-status');
  }

  const flowToolbar = flowEditingEnabled ? document.createElement('div') : null;
  let flowToolbarStatus = null;
  if (flowToolbar) {
    flowToolbar.className = 'rooftop-label-layout-toolbar rooftop-flow-layout-toolbar';
    flowToolbar.innerHTML = `
      <p class="rooftop-label-layout-toolbar-title">Flow path editor</p>
      <p class="rooftop-label-layout-toolbar-copy">Drag colored dots to shape flow in 3D. Double-click a flow line to add a point. Right-click a dot to remove it.</p>
      <div class="rooftop-label-layout-toolbar-actions">
        <button type="button" class="rooftop-label-layout-btn" data-flow-action="copy">Copy flow JSON</button>
        <button type="button" class="rooftop-label-layout-btn is-muted" data-flow-action="seed">Reset to auto paths</button>
      </div>
      <p class="rooftop-label-layout-toolbar-status" aria-live="polite"></p>
    `;
    flowToolbarStatus = flowToolbar.querySelector('.rooftop-label-layout-toolbar-status');
  }

  const legend = document.createElement('div');
  legend.className = 'rooftop-flow-legend rooftop-roof-legend';
  legend.setAttribute('aria-hidden', 'true');
  legend.innerHTML = `
    <p class="rooftop-flow-legend-title">Rooftop legend</p>
    <ul>
      ${ROOF_LEGEND_ITEMS.map(
        (item) => `
          <li>
            <span class="rooftop-flow-swatch" style="background:${item.swatch}"></span>
            ${item.label}
          </li>`
      ).join('')}
    </ul>
  `;

  host.appendChild(flowSvg);
  host.appendChild(leaderSvg);
  host.appendChild(layer);
  if (flowWaypointLayer) host.appendChild(flowWaypointLayer);
  if (anchorLayer) host.appendChild(anchorLayer);
  if (toolbar) host.appendChild(toolbar);
  if (flowToolbar) host.appendChild(flowToolbar);
  host.appendChild(legend);

  let callouts = [];
  const calloutMap = new Map();
  const anchorHandleMap = new Map();
  const flowPathMap = new Map();
  const flowWaypointHandleMap = new Map();
  let layoutState = loadLayoutState();
  let flowLayoutState = loadFlowLayoutState();
  let labelEditing = false;
  let flowEditing = false;
  let dragState = null;
  let legacyAnchorsMigrated = false;
  let flowLayoutInitialized = false;
  const flowScreenCache = new Map();
  const flowInsertRef = new THREE.Vector3();

  function setToolbarStatus(message) {
    if (toolbarStatus) toolbarStatus.textContent = message;
  }

  function setFlowToolbarStatus(message) {
    if (flowToolbarStatus) flowToolbarStatus.textContent = message;
  }

  function getFlowLayoutSnapshot() {
    const snapshot = {};
    Object.entries(flowLayoutState).forEach(([id, entry]) => {
      snapshot[id] = {
        waypoints: (entry.waypoints ?? []).map((waypoint) => ({
          local: cloneLocal(waypoint.local),
        })),
      };
    });
    return snapshot;
  }

  async function copyFlowLayoutToClipboard() {
    const json = JSON.stringify(getFlowLayoutSnapshot(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setFlowToolbarStatus('Flow layout copied to clipboard.');
    } catch {
      console.log('Rooftop flow layout JSON:\n', json);
      setFlowToolbarStatus('Flow layout logged to browser console.');
    }
  }

  function clearFlowWaypointHandles() {
    flowWaypointHandleMap.forEach(({ handle }) => handle.remove());
    flowWaypointHandleMap.clear();
  }

  function ensureFlowLayoutEntry(sequence, anchorCaches, roofOnly) {
    if (flowLayoutState[sequence.id]?.waypoints?.length >= 2) return;
    const autoPath = computeAutoFlowLocalPath(sequence, roofOnly, anchorCaches);
    if (autoPath.length >= 2) {
      flowLayoutState[sequence.id] = { waypoints: waypointsFromLocalPath(autoPath) };
    }
  }

  function getFlowLocalPath(sequence, anchorCaches, roofOnly) {
    const custom = flowLayoutState[sequence.id];
    if (custom?.waypoints?.length >= 2) {
      return localPathFromWaypoints(custom.waypoints);
    }
    return computeAutoFlowLocalPath(sequence, roofOnly, anchorCaches);
  }

  function rebuildFlowWaypointHandles() {
    if (!flowEditingEnabled || !flowWaypointLayer) return;

    clearFlowWaypointHandles();

    ROOF_FLOW_SEQUENCES.forEach((sequence) => {
      const entry = flowLayoutState[sequence.id];
      if (!entry?.waypoints?.length) return;

      entry.waypoints.forEach((_, index) => {
        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = `rooftop-flow-waypoint-handle is-${sequence.kind}`;
        handle.dataset.flowId = sequence.id;
        handle.dataset.waypointIndex = String(index);
        handle.setAttribute('aria-label', `Adjust ${sequence.kind} flow point ${index + 1}`);
        handle.addEventListener('pointerdown', onFlowWaypointPointerDown);
        handle.addEventListener('contextmenu', onFlowWaypointContextMenu);
        flowWaypointLayer.appendChild(handle);
        flowWaypointHandleMap.set(`${sequence.id}:${index}`, {
          handle,
          flowId: sequence.id,
          waypointIndex: index,
          kind: sequence.kind,
        });
      });
    });
  }

  function insertFlowWaypoint(flowId, segmentIndex, t, roofOnly, rect) {
    const entry = flowLayoutState[flowId];
    const cached = flowScreenCache.get(flowId);
    if (!entry?.waypoints?.length || !cached?.locals?.length) return;

    const startLocal = cached.locals[segmentIndex];
    const endLocal = cached.locals[segmentIndex + 1];
    if (!startLocal || !endLocal) return;

    flowInsertRef.lerpVectors(startLocal, endLocal, t);
    const screenMid = {
      x: cached.points[segmentIndex].x + (cached.points[segmentIndex + 1].x - cached.points[segmentIndex].x) * t,
      y: cached.points[segmentIndex].y + (cached.points[segmentIndex + 1].y - cached.points[segmentIndex].y) * t,
    };
    const local = screenPointToLocalAnchor(screenMid.x, screenMid.y, flowInsertRef, roofOnly, camera, rect);

    entry.waypoints.splice(segmentIndex + 1, 0, {
      local: { x: local.x, y: local.y, z: local.z },
    });
    persistFlowLayoutState(flowLayoutState);
    rebuildFlowWaypointHandles();
    setFlowToolbarStatus('Flow point added.');
  }

  function removeFlowWaypoint(flowId, waypointIndex) {
    const entry = flowLayoutState[flowId];
    if (!entry || entry.waypoints.length <= 2) {
      setFlowToolbarStatus('Each flow path needs at least two points.');
      return;
    }

    entry.waypoints.splice(waypointIndex, 1);
    persistFlowLayoutState(flowLayoutState);
    rebuildFlowWaypointHandles();
    setFlowToolbarStatus('Flow point removed.');
  }
  function seedFlowLayoutFromAuto(anchorCaches, roofOnly) {
    flowLayoutState = {};
    ROOF_FLOW_SEQUENCES.forEach((sequence) => {
      const autoPath = computeAutoFlowLocalPath(sequence, roofOnly, anchorCaches);
      if (autoPath.length >= 2) {
        flowLayoutState[sequence.id] = { waypoints: waypointsFromLocalPath(autoPath) };
      }
    });
    persistFlowLayoutState(flowLayoutState);
    flowLayoutInitialized = true;
    rebuildFlowWaypointHandles();
    setFlowToolbarStatus('Flow paths reset to auto routes.');
  }

  flowToolbar?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-flow-action]');
    if (!button) return;

    if (button.dataset.flowAction === 'copy') copyFlowLayoutToClipboard();
    if (button.dataset.flowAction === 'seed') {
      const roofOnly = getRoofOnly();
      const rect = host.getBoundingClientRect();
      if (!roofOnly || !rect.width) return;
      seedFlowLayoutFromAuto(buildAnchorScreenCache(roofOnly, rect), roofOnly);
      update();
    }
  });

  function ensureCalloutLayout(id, anchorCount) {
    if (!layoutState[id]) layoutState[id] = { label: { ox: 0, oy: 0 }, anchors: [] };
    if (!layoutState[id].label) layoutState[id].label = { ox: 0, oy: 0 };
    if (!layoutState[id].anchors) layoutState[id].anchors = [];

    while (layoutState[id].anchors.length < anchorCount) {
      layoutState[id].anchors.push({});
    }

    return layoutState[id];
  }

  function getLayoutSnapshot() {
    const snapshot = {};
    Object.entries(layoutState).forEach(([id, entry]) => {
      snapshot[id] = {
        label: cloneOffset(entry.label),
        anchors: entry.anchors.map((anchor) => {
          if (anchor?.local) return { local: cloneLocal(anchor.local) };
          if ((anchor?.ox ?? 0) !== 0 || (anchor?.oy ?? 0) !== 0) {
            return { ox: anchor.ox ?? 0, oy: anchor.oy ?? 0 };
          }
          return {};
        }),
      };
    });
    return snapshot;
  }

  async function copyLayoutToClipboard() {
    const json = JSON.stringify(getLayoutSnapshot(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setToolbarStatus('Layout copied to clipboard.');
    } catch {
      console.log('Rooftop label layout JSON:\n', json);
      setToolbarStatus('Layout logged to browser console.');
    }
  }

  function resetLayout() {
    layoutState = {};
    persistLayoutState(layoutState);
    setToolbarStatus('Layout reset.');
  }

  toolbar?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    if (button.dataset.action === 'copy') copyLayoutToClipboard();
    if (button.dataset.action === 'reset') resetLayout();
  });

  function ensureLeaderDefs() {
    if (leaderSvg.querySelector('#rooftop-label-arrow')) return;
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'rooftop-label-arrow');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '8');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '5');
    marker.setAttribute('markerHeight', '5');
    marker.setAttribute('orient', 'auto');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    path.setAttribute('fill', '#00375a');
    path.setAttribute('fill-opacity', '0.55');
    marker.appendChild(path);
    defs.appendChild(marker);
    leaderSvg.appendChild(defs);
  }

  function ensureFlowDefs() {
    if (flowSvg.querySelector('#rooftop-flow-exhaust-marker')) return;

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const exhaustMarker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    exhaustMarker.setAttribute('id', 'rooftop-flow-exhaust-marker');
    exhaustMarker.setAttribute('viewBox', '0 0 10 10');
    exhaustMarker.setAttribute('refX', '8.5');
    exhaustMarker.setAttribute('refY', '5');
    exhaustMarker.setAttribute('markerWidth', '4');
    exhaustMarker.setAttribute('markerHeight', '4');
    exhaustMarker.setAttribute('orient', 'auto');
    exhaustMarker.innerHTML = `<path d="M 0 0 L 10 5 L 0 10 z" fill="${FLOW_COLORS.exhaust}" fill-opacity="0.85" />`;

    const supplyMarker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    supplyMarker.setAttribute('id', 'rooftop-flow-supply-marker');
    supplyMarker.setAttribute('viewBox', '0 0 10 10');
    supplyMarker.setAttribute('refX', '8.5');
    supplyMarker.setAttribute('refY', '5');
    supplyMarker.setAttribute('markerWidth', '4');
    supplyMarker.setAttribute('markerHeight', '4');
    supplyMarker.setAttribute('orient', 'auto');
    supplyMarker.innerHTML = `<path d="M 0 0 L 10 5 L 0 10 z" fill="${FLOW_COLORS.supply}" fill-opacity="0.85" />`;

    defs.appendChild(exhaustMarker);
    defs.appendChild(supplyMarker);
    flowSvg.appendChild(defs);
  }

  function buildFlowPaths() {
    flowPathMap.forEach(({ path }) => path.remove());
    flowPathMap.clear();
    ensureFlowDefs();

    ROOF_FLOW_SEQUENCES.forEach((sequence) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', `rooftop-flow-path is-${sequence.kind}`);
      path.dataset.flowId = sequence.id;
      path.setAttribute('stroke', FLOW_COLORS[sequence.kind]);
      path.setAttribute(
        'marker-end',
        sequence.kind === 'exhaust'
          ? 'url(#rooftop-flow-exhaust-marker)'
          : 'url(#rooftop-flow-supply-marker)'
      );
      if (flowEditingEnabled) {
        path.addEventListener('dblclick', onFlowPathDblClick);
      }
      flowSvg.appendChild(path);
      flowPathMap.set(sequence.id, { sequence, path });
    });
  }

  function clearAnchorHandles() {
    anchorHandleMap.forEach(({ handle }) => handle.remove());
    anchorHandleMap.clear();
  }

  function rebuild() {
    calloutMap.forEach(({ callout }) => callout.remove());
    calloutMap.clear();
    clearAnchorHandles();
    leaderSvg.replaceChildren();
    flowSvg.replaceChildren();
    ensureLeaderDefs();
    ensureFlowDefs();
    buildFlowPaths();

    const roofOnly = getRoofOnly();
    callouts = discoverRoofLabelCallouts(roofOnly);

    callouts.forEach((spec) => {
      ensureCalloutLayout(spec.id, spec.localPoints.length);

      const lines = spec.localPoints.map((_, index) => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'rooftop-label-line');
        line.setAttribute('marker-end', 'url(#rooftop-label-arrow)');
        line.dataset.calloutId = spec.id;
        line.dataset.anchorIndex = String(index);
        leaderSvg.appendChild(line);
        return line;
      });

      const callout = document.createElement('div');
      callout.className = 'rooftop-label-callout';
      if (spec.multiAnchor) callout.classList.add('is-multi-anchor');
      callout.dataset.calloutId = spec.id;
      callout.innerHTML = `
        <div class="rooftop-label-card">
          <span class="rooftop-label-swatch" style="background:${spec.swatch}"></span>
          <strong>${spec.title}</strong>
          ${spec.body ? `<span class="rooftop-label-body">${spec.body}</span>` : ''}
        </div>
      `;
      layer.appendChild(callout);
      const card = callout.querySelector('.rooftop-label-card');
      const cardSize = measureCalloutCardSize(callout, card);
      if (layoutEditingEnabled) {
        callout.addEventListener('pointerdown', onLabelPointerDown);

        spec.localPoints.forEach((_, index) => {
          const handle = document.createElement('button');
          handle.type = 'button';
          handle.className = 'rooftop-label-anchor-handle';
          handle.dataset.calloutId = spec.id;
          handle.dataset.anchorIndex = String(index);
          handle.setAttribute('aria-label', `Adjust arrow point for ${spec.title}`);
          handle.addEventListener('pointerdown', onAnchorPointerDown);
          anchorLayer.appendChild(handle);
          anchorHandleMap.set(`${spec.id}:${index}`, { handle, specId: spec.id, anchorIndex: index });
        });
      }

      calloutMap.set(spec.id, { spec, callout, lines, cardSize });
    });

    if (flowEditingEnabled) rebuildFlowWaypointHandles();
  }

  function setLabelEditing(active) {
    if (!layoutEditingEnabled || labelEditing === active) return;
    labelEditing = active;
    layer.classList.toggle('is-editing', active);
    toolbar?.classList.toggle('is-visible', active);
  }

  function setFlowEditing(active) {
    if (!flowEditingEnabled || flowEditing === active) return;
    flowEditing = active;
    host.classList.toggle('is-roof-flow-editing', active);
    flowWaypointLayer?.classList.toggle('is-editing', active);
    flowSvg.classList.toggle('is-editing', active);
    flowToolbar?.classList.toggle('is-visible', active);
  }

  function setVisible(visible, alpha) {
    layer.setAttribute('aria-hidden', visible ? 'false' : 'true');
    flowSvg.setAttribute('aria-hidden', visible ? 'false' : 'true');
    flowWaypointLayer?.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (anchorLayer) anchorLayer.setAttribute('aria-hidden', visible ? 'false' : 'true');
    legend.setAttribute('aria-hidden', visible ? 'false' : 'true');
    legend.classList.toggle('is-visible', visible);
    legend.style.opacity = visible ? String(Math.min(1, (alpha - 0.35) / 0.45)) : '0';
    if (layoutEditingEnabled) setLabelEditing(visible);
    if (flowEditingEnabled) setFlowEditing(visible);
  }

  function hideAll() {
    setVisible(false, 0);
    calloutMap.forEach(({ callout, lines }) => {
      callout.classList.remove('is-visible');
      lines.forEach((line) => {
        line.style.opacity = '0';
      });
    });
    anchorHandleMap.forEach(({ handle }) => {
      handle.classList.remove('is-visible');
    });
    flowPathMap.forEach(({ path }) => {
      path.classList.remove('is-visible');
      path.style.opacity = '0';
    });
    flowWaypointHandleMap.forEach(({ handle }) => {
      handle.classList.remove('is-visible');
    });
  }

  function buildAnchorScreenCache(roofOnly, rect) {
    const screen = new Map();
    const local = new Map();
    calloutMap.forEach(({ spec }) => {
      const layout = ensureCalloutLayout(spec.id, spec.localPoints.length);
      spec.localPoints.forEach((_, index) => {
        resolveAnchorLocal(spec, layout, index, roofOnly, camera, rect, localAnchorPoint);
        const key = `${spec.id}:${index}`;
        local.set(key, localAnchorPoint.clone());
        screen.set(key, projectLocalToScreen(localAnchorPoint, roofOnly, camera, rect));
      });
    });
    return { screen, local };
  }

  function updateFlowPaths(anchorCaches, roofOnly, rect, flowOpacity) {
    flowScreenCache.clear();

    flowPathMap.forEach(({ sequence, path }) => {
      const localPath = getFlowLocalPath(sequence, anchorCaches, roofOnly);
      if (localPath.length < 2) {
        path.classList.remove('is-visible');
        path.style.opacity = '0';
        return;
      }

      const screenPoints = localPath.map((point) => projectLocalToScreen(point, roofOnly, camera, rect));
      flowScreenCache.set(sequence.id, { points: screenPoints, locals: localPath });

      const allVisible = screenPoints.every((point) => point.visible);
      path.classList.toggle('is-visible', allVisible);
      if (!allVisible) {
        path.style.opacity = '0';
        return;
      }

      path.setAttribute('d', pointsToPathD(screenPoints));
      path.style.opacity = flowOpacity;
    });
  }

  function hostPointFromClient(clientX, clientY) {
    const rect = host.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function migrateLegacyAnchorLayouts(roofOnly, rect) {
    if (legacyAnchorsMigrated) return;

    let changed = false;
    calloutMap.forEach(({ spec }) => {
      const layout = ensureCalloutLayout(spec.id, spec.localPoints.length);
      layout.anchors.forEach((entry, index) => {
        if (entry?.local) return;
        if ((entry?.ox ?? 0) === 0 && (entry?.oy ?? 0) === 0) return;
        const migrated = screenOffsetToLocalAnchor(
          spec.localPoints[index],
          entry,
          roofOnly,
          camera,
          rect
        );
        layout.anchors[index] = {
          local: { x: migrated.x, y: migrated.y, z: migrated.z },
        };
        changed = true;
      });
    });

    legacyAnchorsMigrated = true;
    if (changed) persistLayoutState(layoutState);
  }

  function beginDrag(type, id, anchorIndex, clientX, clientY, pointerId) {
    const roofOnly = getRoofOnly();
    const rect = host.getBoundingClientRect();
    const start = hostPointFromClient(clientX, clientY);

    if (type === 'flow-waypoint') {
      const waypoint = flowLayoutState[id]?.waypoints?.[anchorIndex];
      if (!waypoint?.local) return;
    }

    dragState = {
      type,
      id,
      anchorIndex,
      pointerId,
      startX: start.x,
      startY: start.y,
      startLabel: null,
      startLocal: null,
      moved: false,
    };

    if (type === 'label') {
      const layout = ensureCalloutLayout(id, calloutMap.get(id)?.spec.localPoints.length ?? 1);
      dragState.startLabel = cloneOffset(layout.label);
      const callout = calloutMap.get(id)?.callout;
      callout?.classList.add('is-dragging');
      callout?.setPointerCapture?.(pointerId);
    } else if (type === 'anchor') {
      const layout = ensureCalloutLayout(id, calloutMap.get(id)?.spec.localPoints.length ?? 1);
      const spec = calloutMap.get(id)?.spec;
      dragState.startLocal = resolveAnchorLocal(
        spec,
        layout,
        anchorIndex,
        roofOnly,
        camera,
        rect,
        new THREE.Vector3()
      );
      const handle = anchorHandleMap.get(`${id}:${anchorIndex}`)?.handle;
      handle?.classList.add('is-dragging');
      handle?.setPointerCapture?.(pointerId);
    } else if (type === 'flow-waypoint') {
      const waypoint = flowLayoutState[id].waypoints[anchorIndex];
      dragState.startLocal = new THREE.Vector3(waypoint.local.x, waypoint.local.y, waypoint.local.z);
      const handle = flowWaypointHandleMap.get(`${id}:${anchorIndex}`)?.handle;
      handle?.classList.add('is-dragging');
      handle?.setPointerCapture?.(pointerId);
    }
  }

  function finishDrag(event) {
    if (!dragState) return;
    if (event?.pointerId != null && dragState.pointerId !== event.pointerId) return;

    if (dragState.type === 'label') {
      const callout = calloutMap.get(dragState.id)?.callout;
      callout?.classList.remove('is-dragging');
      if (callout?.hasPointerCapture?.(dragState.pointerId)) {
        callout.releasePointerCapture(dragState.pointerId);
      }
    } else if (dragState.type === 'anchor') {
      const handle = anchorHandleMap.get(`${dragState.id}:${dragState.anchorIndex}`)?.handle;
      handle?.classList.remove('is-dragging');
      if (handle?.hasPointerCapture?.(dragState.pointerId)) {
        handle.releasePointerCapture(dragState.pointerId);
      }
    } else if (dragState.type === 'flow-waypoint') {
      const handle = flowWaypointHandleMap.get(`${dragState.id}:${dragState.anchorIndex}`)?.handle;
      handle?.classList.remove('is-dragging');
      if (handle?.hasPointerCapture?.(dragState.pointerId)) {
        handle.releasePointerCapture(dragState.pointerId);
      }
    }

    if (dragState.moved) {
      if (dragState.type === 'flow-waypoint') {
        persistFlowLayoutState(flowLayoutState);
        setFlowToolbarStatus('Flow layout saved.');
      } else {
        persistLayoutState(layoutState);
        setToolbarStatus('Layout saved.');
      }
    }

    dragState = null;
  }

  function onLabelPointerDown(event) {
    if (!layoutEditingEnabled || !labelEditing) return;
    beginDrag('label', event.currentTarget.dataset.calloutId, null, event.clientX, event.clientY, event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function onAnchorPointerDown(event) {
    if (!layoutEditingEnabled || !labelEditing) return;
    beginDrag(
      'anchor',
      event.currentTarget.dataset.calloutId,
      Number(event.currentTarget.dataset.anchorIndex),
      event.clientX,
      event.clientY,
      event.pointerId
    );
    event.preventDefault();
    event.stopPropagation();
  }

  function onFlowWaypointPointerDown(event) {
    if (!flowEditingEnabled || !flowEditing) return;
    if (event.button !== 0) return;
    beginDrag(
      'flow-waypoint',
      event.currentTarget.dataset.flowId,
      Number(event.currentTarget.dataset.waypointIndex),
      event.clientX,
      event.clientY,
      event.pointerId
    );
    event.preventDefault();
    event.stopPropagation();
  }

  function onFlowWaypointContextMenu(event) {
    if (!flowEditingEnabled || !flowEditing) return;
    event.preventDefault();
    removeFlowWaypoint(event.currentTarget.dataset.flowId, Number(event.currentTarget.dataset.waypointIndex));
    update();
  }

  function onFlowPathDblClick(event) {
    if (!flowEditingEnabled || !flowEditing) return;

    const roofOnly = getRoofOnly();
    const rect = host.getBoundingClientRect();
    if (!roofOnly || !rect.width) return;

    const clickPoint = hostPointFromClient(event.clientX, event.clientY);
    let bestFlowId = null;
    let bestSegment = -1;
    let bestDistance = Infinity;
    let bestT = 0.5;

    flowScreenCache.forEach((cached, flowId) => {
      for (let index = 0; index < cached.points.length - 1; index += 1) {
        const start = cached.points[index];
        const end = cached.points[index + 1];
        if (!start.visible || !end.visible) continue;

        const result = distancePointToSegment(clickPoint, start, end);
        if (result.distance < bestDistance) {
          bestDistance = result.distance;
          bestFlowId = flowId;
          bestSegment = index;
          bestT = result.t;
        }
      }
    });

    if (bestFlowId == null || bestDistance > 18) return;

    insertFlowWaypoint(bestFlowId, bestSegment, bestT, roofOnly, rect);
    update();
    event.preventDefault();
    event.stopPropagation();
  }

  function onPointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const roofOnly = getRoofOnly();
    const rect = host.getBoundingClientRect();
    const point = hostPointFromClient(event.clientX, event.clientY);
    const dx = point.x - dragState.startX;
    const dy = point.y - dragState.startY;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) dragState.moved = true;

    if (dragState.type === 'label') {
      const layout = ensureCalloutLayout(
        dragState.id,
        calloutMap.get(dragState.id)?.spec.localPoints.length ?? 1
      );
      layout.label = {
        ox: dragState.startLabel.ox + dx,
        oy: dragState.startLabel.oy + dy,
      };
    } else if (dragState.type === 'anchor') {
      const layout = ensureCalloutLayout(
        dragState.id,
        calloutMap.get(dragState.id)?.spec.localPoints.length ?? 1
      );
      const local = screenPointToLocalAnchor(
        point.x,
        point.y,
        dragState.startLocal,
        roofOnly,
        camera,
        rect
      );
      layout.anchors[dragState.anchorIndex] = {
        local: { x: local.x, y: local.y, z: local.z },
      };
    } else if (dragState.type === 'flow-waypoint') {
      const entry = flowLayoutState[dragState.id];
      const waypoint = entry?.waypoints?.[dragState.anchorIndex];
      if (!waypoint) return;

      const local = screenPointToLocalAnchor(
        point.x,
        point.y,
        dragState.startLocal,
        roofOnly,
        camera,
        rect
      );
      waypoint.local = { x: local.x, y: local.y, z: local.z };
    }

    update();
    event.preventDefault();
  }

  if (layoutEditingEnabled || flowEditingEnabled) {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
  }

  function update() {
    const alpha = getAlpha();
    const roofOnly = getRoofOnly();

    if (!roofOnly || alpha <= 0.02 || !callouts.length) {
      hideAll();
      return;
    }

    const show = alpha > 0.35;
    setVisible(show, alpha);
    if (!show) return;

    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    roofOnly.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    if (layoutEditingEnabled) migrateLegacyAnchorLayouts(roofOnly, rect);
    const anchorCaches = buildAnchorScreenCache(roofOnly, rect);

    if (flowEditingEnabled && !flowLayoutInitialized) {
      ROOF_FLOW_SEQUENCES.forEach((sequence) => {
        ensureFlowLayoutEntry(sequence, anchorCaches, roofOnly);
      });
      flowLayoutInitialized = true;
      rebuildFlowWaypointHandles();
    }

    const labelOpacity = String(Math.min(1, (alpha - 0.35) / 0.45));
    const flowOpacity = String(Math.min(0.62, (alpha - 0.35) / 0.55));
    updateFlowPaths(anchorCaches, roofOnly, rect, flowOpacity);

    calloutMap.forEach(({ spec, callout, lines, cardSize }) => {
      const layout = ensureCalloutLayout(spec.id, spec.localPoints.length);

      const anchorScreens = spec.localPoints.map((_, index) =>
        anchorCaches.screen.get(`${spec.id}:${index}`)
      );

      const baseAnchorScreens = spec.localPoints.map((localPoint) =>
        projectLocalToScreen(localPoint, roofOnly, camera, rect)
      );

      const allVisible = anchorScreens.every((point) => point?.visible);
      callout.classList.toggle('is-visible', allVisible);
      if (!allVisible) {
        lines.forEach((line) => {
          line.style.opacity = '0';
        });
        spec.localPoints.forEach((_, index) => {
          anchorHandleMap.get(`${spec.id}:${index}`)?.handle.classList.remove('is-visible');
        });
        return;
      }

      const leadAnchor = baseAnchorScreens[0];
      const autoOffset = placementOffset(spec.placement, leadAnchor, rect, baseAnchorScreens);
      const labelX = leadAnchor.x + autoOffset.ox + layout.label.ox;
      const labelY = leadAnchor.y + autoOffset.oy + layout.label.oy;

      callout.style.left = `${labelX}px`;
      callout.style.top = `${labelY}px`;
      callout.style.opacity = labelOpacity;

      if (!cardSize.height) {
        const card = callout.querySelector('.rooftop-label-card');
        Object.assign(cardSize, measureCalloutCardSize(callout, card));
      }

      const attach = leaderAttachFromLabel(labelX, labelY, cardSize);

      lines.forEach((line, index) => {
        const anchor = anchorScreens[index];
        if (!anchor) return;
        line.style.opacity = labelOpacity;
        line.setAttribute('x1', String(anchor.x));
        line.setAttribute('y1', String(anchor.y));
        line.setAttribute('x2', String(attach.x));
        line.setAttribute('y2', String(attach.y));
      });

      if (layoutEditingEnabled) {
        spec.localPoints.forEach((_, index) => {
          const handleEntry = anchorHandleMap.get(`${spec.id}:${index}`);
          if (!handleEntry) return;
          const anchor = anchorScreens[index];
          handleEntry.handle.style.left = `${anchor.x}px`;
          handleEntry.handle.style.top = `${anchor.y}px`;
          handleEntry.handle.style.opacity = labelOpacity;
          handleEntry.handle.classList.add('is-visible');
        });
      }
    });

    if (flowEditingEnabled) {
      flowWaypointHandleMap.forEach(({ handle, flowId, waypointIndex }) => {
        const cached = flowScreenCache.get(flowId);
        const screen = cached?.points?.[waypointIndex];
        if (!screen?.visible) {
          handle.classList.remove('is-visible');
          return;
        }
        handle.style.left = `${screen.x}px`;
        handle.style.top = `${screen.y}px`;
        handle.style.opacity = flowOpacity;
        handle.classList.add('is-visible');
      });
    }
  }

  function dispose() {
    if (layoutEditingEnabled || flowEditingEnabled) {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    }
    calloutMap.forEach(({ callout }) => callout.remove());
    calloutMap.clear();
    clearAnchorHandles();
    clearFlowWaypointHandles();
    flowSvg.remove();
    leaderSvg.remove();
    layer.remove();
    flowWaypointLayer?.remove();
    anchorLayer?.remove();
    toolbar?.remove();
    flowToolbar?.remove();
    legend.remove();
  }

  if (typeof window !== 'undefined' && layoutEditingEnabled) {
    window.__ruhlRoofLabelEditor = {
      getLayout: getLayoutSnapshot,
      copyLayout: copyLayoutToClipboard,
      resetLayout,
    };
  }

  if (typeof window !== 'undefined' && flowEditingEnabled) {
    window.__ruhlRoofFlowEditor = {
      getLayout: getFlowLayoutSnapshot,
      copyLayout: copyFlowLayoutToClipboard,
      seedFromAuto: () => {
        const roofOnly = getRoofOnly();
        const rect = host.getBoundingClientRect();
        if (!roofOnly || !rect.width) return;
        seedFlowLayoutFromAuto(buildAnchorScreenCache(roofOnly, rect), roofOnly);
        update();
      },
    };
  }

  return {
    rebuild,
    update,
    dispose,
    getLayout: getLayoutSnapshot,
    getFlowLayout: getFlowLayoutSnapshot,
  };
}
