import * as THREE from 'three';

export const ROOFTOP_END_FIT_MARGIN = 0.72;
export const ROOFTOP_END_DISTANCE_SCALE = 0.96;
export const SKY_SITE_BOTTOM = 0xf7f8f8;

export function createStudioSkyBackground() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#dce6ee');
  gradient.addColorStop(0.46, '#eef2f5');
  gradient.addColorStop(1, '#f7f8f8');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function applyStudioAtmosphere(scene, viewRadius) {
  const r = Math.max(viewRadius || 12, 8);
  scene.fog = new THREE.Fog(SKY_SITE_BOTTOM, r * 0.85, r * 3.15);
}

export function prepareMaterials(object) {
  object.traverse((node) => {
    if (!node.isMesh) return;
    node.frustumCulled = false;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      if (!material) return;
      material.side = THREE.DoubleSide;
      if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
      material.needsUpdate = true;
    });
  });
}

function rebuildRoofVertexCache(object, cacheRef) {
  const localSamples = [];
  const vertex = new THREE.Vector3();
  const local = new THREE.Vector3();

  object.updateMatrixWorld(true);
  object.traverse((node) => {
    if (!node.isMesh || !node.geometry?.attributes?.position) return;
    const positions = node.geometry.attributes.position;
    const stride = Math.max(1, Math.floor(positions.count / 1200));

    for (let i = 0; i < positions.count; i += stride) {
      vertex.fromBufferAttribute(positions, i);
      local.copy(vertex);
      node.localToWorld(local);
      object.worldToLocal(local);
      localSamples.push(local.clone());
    }
  });

  if (!localSamples.length) {
    cacheRef.current = null;
    return;
  }

  const localBox = new THREE.Box3();
  localSamples.forEach((point) => localBox.expandByPoint(point));
  const roofBandMin = localBox.min.y + (localBox.max.y - localBox.min.y) * 0.82;
  cacheRef.current = {
    object,
    localVertices: localSamples.filter((point) => point.y >= roofBandMin),
  };
}

function getRooftopMeshBounds(object, cacheRef) {
  if (!cacheRef.current || cacheRef.current.object !== object) {
    rebuildRoofVertexCache(object, cacheRef);
  }

  if (cacheRef.current?.localVertices.length) {
    const roofBox = new THREE.Box3();
    const world = new THREE.Vector3();
    cacheRef.current.localVertices.forEach((local) => {
      world.copy(local);
      object.localToWorld(world);
      roofBox.expandByPoint(world);
    });
    if (!roofBox.isEmpty()) return roofBox;
  }

  return new THREE.Box3().setFromObject(object);
}

function getBoundsFramePoints(box) {
  const { min, max } = box;
  const height = Math.max(max.y - min.y, 0.001);
  const yLevels = [max.y, max.y - height * 0.35, max.y - height * 0.7];
  const points = [];

  yLevels.forEach((y) => {
    points.push(
      new THREE.Vector3(min.x, y, min.z),
      new THREE.Vector3(max.x, y, min.z),
      new THREE.Vector3(max.x, y, max.z),
      new THREE.Vector3(min.x, y, max.z)
    );
  });

  return points;
}

function getRooftopFramePoints(object, cacheRef) {
  return getBoundsFramePoints(getRooftopMeshBounds(object, cacheRef));
}

function estimateFootprintLongAxisAngle(object) {
  const box = new THREE.Box3().setFromObject(object);
  const bandTop = box.min.y + (box.max.y - box.min.y) * 0.2;
  const samples = [];
  const vertex = new THREE.Vector3();

  object.traverse((node) => {
    if (!node.isMesh || !node.geometry?.attributes?.position) return;
    const positions = node.geometry.attributes.position;
    const stride = Math.max(1, Math.floor(positions.count / 800));

    for (let i = 0; i < positions.count; i += stride) {
      vertex.fromBufferAttribute(positions, i);
      node.localToWorld(vertex);
      if (vertex.y <= bandTop) samples.push(new THREE.Vector2(vertex.x, vertex.z));
    }
  });

  if (samples.length < 8) return 0;

  let meanX = 0;
  let meanZ = 0;
  samples.forEach((point) => {
    meanX += point.x;
    meanZ += point.y;
  });
  meanX /= samples.length;
  meanZ /= samples.length;

  let covXX = 0;
  let covZZ = 0;
  let covXZ = 0;
  samples.forEach((point) => {
    const dx = point.x - meanX;
    const dz = point.y - meanZ;
    covXX += dx * dx;
    covZZ += dz * dz;
    covXZ += dx * dz;
  });

  return 0.5 * Math.atan2(2 * covXZ, covXX - covZZ);
}

function getLongFootprintEdges(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const { min, max } = box;
  const yBase = min.y + size.y * 0.06;
  const yRoof = max.y - size.y * 0.04;
  const longAxisX = size.x >= size.z;

  const edgesForY = (y) => {
    if (longAxisX) {
      return [
        [new THREE.Vector3(min.x, y, min.z), new THREE.Vector3(max.x, y, min.z)],
        [new THREE.Vector3(min.x, y, max.z), new THREE.Vector3(max.x, y, max.z)],
      ];
    }
    return [
      [new THREE.Vector3(min.x, y, min.z), new THREE.Vector3(min.x, y, max.z)],
      [new THREE.Vector3(max.x, y, min.z), new THREE.Vector3(max.x, y, max.z)],
    ];
  };

  return [...edgesForY(yBase), ...edgesForY(yRoof)];
}

function screenEdgeTiltFromHorizontal(start, end, cam) {
  const a = start.clone().project(cam);
  const b = end.clone().project(cam);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx * dx + dy * dy < 1e-8) return Math.PI / 2;

  let angle = Math.abs(Math.atan2(dy, dx));
  if (angle > Math.PI / 2) angle = Math.PI - angle;
  return angle;
}

function createRooftopAlignCamera(roofPos, roofLook, fov, aspect) {
  const alignCam = new THREE.PerspectiveCamera(fov, aspect, 0.1, 500);
  alignCam.position.copy(roofPos);
  alignCam.up.set(0, 1, 0);
  alignCam.lookAt(roofLook);
  alignCam.updateMatrixWorld(true);
  return alignCam;
}

function measureLongFootprintEdgeTilt(object, roofPos, roofLook, fov, aspect) {
  const alignCam = createRooftopAlignCamera(roofPos, roofLook, fov, aspect);

  let worst = 0;
  getLongFootprintEdges(object).forEach(([start, end]) => {
    worst = Math.max(worst, screenEdgeTiltFromHorizontal(start, end, alignCam));
  });
  return worst;
}

function snapRooftopLongEdgeHorizontal(object, fov, aspect, cacheRef) {
  rebuildRoofVertexCache(object, cacheRef);
  const pcaBase = -estimateFootprintLongAxisAngle(object);
  const roofPos = new THREE.Vector3();
  const roofLook = new THREE.Vector3();
  let bestRotation = pcaBase;
  let bestTilt = Infinity;

  for (let step = 0; step < 72; step += 1) {
    object.rotation.y = pcaBase + (step * Math.PI * 2) / 72;
    object.updateMatrixWorld(true);
    buildRooftopCameraVectors(object, roofPos, roofLook, fov, aspect, cacheRef);
    const tilt = measureLongFootprintEdgeTilt(object, roofPos, roofLook, fov, aspect);
    if (tilt < bestTilt) {
      bestTilt = tilt;
      bestRotation = object.rotation.y;
    }
  }

  for (let step = -120; step <= 120; step += 1) {
    object.rotation.y = bestRotation + step / 1200;
    object.updateMatrixWorld(true);
    buildRooftopCameraVectors(object, roofPos, roofLook, fov, aspect, cacheRef);
    const tilt = measureLongFootprintEdgeTilt(object, roofPos, roofLook, fov, aspect);
    if (tilt < bestTilt) {
      bestTilt = tilt;
      bestRotation = object.rotation.y;
    }
  }

  object.rotation.y = bestRotation + Math.PI;
  object.updateMatrixWorld(true);
}

export function buildRooftopCameraVectors(object, outPos, outLook, fov, aspect, cacheRef, mobile = false) {
  const roofBox = getRooftopMeshBounds(object, cacheRef);
  const roofSize = roofBox.getSize(new THREE.Vector3());
  const roofCenter = roofBox.getCenter(new THREE.Vector3());
  const pitchDown = (52 * Math.PI) / 180;
  const compositionLift = roofSize.y * (mobile ? 0.08 : 0.1);
  const roofSpan = Math.max(roofSize.x, roofSize.z, roofSize.y * 0.5);
  let horizontalDist = roofSpan * (mobile ? 0.92 : 1.0);

  outLook.set(roofCenter.x, roofCenter.y - roofSize.y * 0.12 + compositionLift, roofCenter.z);

  const alignCam = createRooftopAlignCamera(outPos, outLook, fov, aspect);
  const corners = getRooftopFramePoints(object, cacheRef);

  for (let attempt = 0; attempt < 18; attempt += 1) {
    const verticalDist = horizontalDist * Math.tan(pitchDown);
    outPos.set(outLook.x, outLook.y + verticalDist, outLook.z + horizontalDist);
    alignCam.position.copy(outPos);
    alignCam.lookAt(outLook);
    alignCam.updateMatrixWorld(true);

    const projected = corners.map((corner) => corner.clone().project(alignCam));
    const maxExtent = projected.reduce(
      (peak, point) => Math.max(peak, Math.abs(point.x), Math.abs(point.y)),
      0
    );

    if (maxExtent <= ROOFTOP_END_FIT_MARGIN) break;
    horizontalDist *= 1.08;
  }

  horizontalDist *= ROOFTOP_END_DISTANCE_SCALE;
  const verticalDist = horizontalDist * Math.tan(pitchDown);
  outPos.set(outLook.x, outLook.y + verticalDist, outLook.z + horizontalDist);
}

export function getObjectPivot(object) {
  return new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
}

function getMeshWorldVertices(object, sampleBudget = 1500) {
  const worldVertices = [];
  const vertex = new THREE.Vector3();

  object.updateMatrixWorld(true);
  object.traverse((node) => {
    if (!node.isMesh || !node.geometry?.attributes?.position) return;
    const positions = node.geometry.attributes.position;
    const stride = Math.max(1, Math.floor(positions.count / sampleBudget));

    for (let i = 0; i < positions.count; i += stride) {
      vertex.fromBufferAttribute(positions, i);
      node.localToWorld(vertex);
      worldVertices.push(vertex.clone());
    }
  });

  return worldVertices;
}

function getRooftopWorldVertices(object, cacheRef) {
  if (!cacheRef.current || cacheRef.current.object !== object) {
    rebuildRoofVertexCache(object, cacheRef);
  }

  const worldVertices = [];
  const world = new THREE.Vector3();
  cacheRef.current?.localVertices.forEach((local) => {
    world.copy(local);
    object.localToWorld(world);
    worldVertices.push(world.clone());
  });
  return worldVertices;
}

function getProjectedScreenBounds(points, alignCam) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const projected = new THREE.Vector3();

  points.forEach((point) => {
    projected.copy(point).project(alignCam);
    minX = Math.min(minX, projected.x);
    maxX = Math.max(maxX, projected.x);
    minY = Math.min(minY, projected.y);
    maxY = Math.max(maxY, projected.y);
  });

  return {
    cx: (minX + maxX) * 0.5,
    cy: (minY + maxY) * 0.5,
    w: maxX - minX,
    h: maxY - minY,
  };
}

function ndcOffsetToWorldDelta(dx, dy, anchor, alignCam) {
  const ndc = anchor.clone().project(alignCam);
  const next = new THREE.Vector3(ndc.x + dx, ndc.y + dy, ndc.z).unproject(alignCam);
  return next.sub(anchor);
}

function applyUniformScaleAround(object, scaleFactor, pivot) {
  object.position.sub(pivot);
  object.scale.multiplyScalar(scaleFactor);
  object.position.add(pivot);
  object.updateMatrixWorld(true);
}

function snapRoofOnlyToRooftopScreen(roofOnly, building, roofPos, roofLook, inspectFov, aspect, cacheRef) {
  const alignCam = createRooftopAlignCamera(roofPos, roofLook, inspectFov, aspect);
  const getTargetSamples = () => getRooftopWorldVertices(building, cacheRef);
  const getSourceSamples = () => getMeshWorldVertices(roofOnly);

  const recenterOnTarget = () => {
    const target = getProjectedScreenBounds(getTargetSamples(), alignCam);
    const source = getProjectedScreenBounds(getSourceSamples(), alignCam);
    const pivot = getObjectPivot(roofOnly);
    roofOnly.position.add(
      ndcOffsetToWorldDelta(target.cx - source.cx, target.cy - source.cy, pivot, alignCam)
    );
    roofOnly.updateMatrixWorld(true);
  };

  for (let attempt = 0; attempt < 12; attempt += 1) {
    roofOnly.updateMatrixWorld(true);
    building.updateMatrixWorld(true);
    const target = getProjectedScreenBounds(getTargetSamples(), alignCam);
    const source = getProjectedScreenBounds(getSourceSamples(), alignCam);
    const dx = target.cx - source.cx;
    const dy = target.cy - source.cy;
    if (Math.abs(dx) < 0.00015 && Math.abs(dy) < 0.00015) break;
    recenterOnTarget();
  }

  for (let attempt = 0; attempt < 24; attempt += 1) {
    roofOnly.updateMatrixWorld(true);
    building.updateMatrixWorld(true);

    const target = getProjectedScreenBounds(getTargetSamples(), alignCam);
    const source = getProjectedScreenBounds(getSourceSamples(), alignCam);
    const wRatio = target.w / Math.max(source.w, 1e-8);
    const hRatio = target.h / Math.max(source.h, 1e-8);

    if (Math.abs(wRatio - 1) < 0.0008 && Math.abs(hRatio - 1) < 0.0008) break;

    const scaleFix = Math.sqrt(wRatio * hRatio);
    applyUniformScaleAround(roofOnly, scaleFix, getObjectPivot(roofOnly));
    recenterOnTarget();
  }
}

/** Match full-building rooftop inspect used by the scroll end frame. */
export function fitBuildingForRooftopInspect(building, { mobile = false, endFov = 32, aspect = 1 } = {}) {
  const cacheRef = { current: null };
  prepareMaterials(building);

  building.position.set(0, 0, 0);
  building.rotation.set(0, 0, 0);
  building.scale.set(1, 1, 1);
  building.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(building);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const initialCenter = center.clone();

  building.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const targetSize = mobile ? 7.5 : 8.5;
  const fitScale = maxDim > 0 ? targetSize / maxDim : 1;
  building.scale.setScalar(fitScale);
  building.updateMatrixWorld(true);

  const fittedBox = new THREE.Box3().setFromObject(building);
  const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
  const fittedCenterBeforeRecenter = fittedCenter.clone();
  building.position.sub(fittedCenter);
  building.updateMatrixWorld(true);

  fittedBox.setFromObject(building);
  const fittedSize = fittedBox.getSize(new THREE.Vector3());

  if (fittedSize.z > fittedSize.x) {
    building.rotation.y = Math.PI / 2;
    building.updateMatrixWorld(true);
    fittedBox.setFromObject(building);
    fittedBox.getSize(fittedSize);
  }

  const inspectFov = Math.max(29, endFov - 3);
  snapRooftopLongEdgeHorizontal(building, inspectFov, aspect, cacheRef);

  const buildingFit = {
    initialCenter,
    fittedCenter: fittedCenterBeforeRecenter,
    fitScale,
    finalRotationY: building.rotation.y,
  };

  const roofPos = new THREE.Vector3();
  const roofLook = new THREE.Vector3();
  buildRooftopCameraVectors(building, roofPos, roofLook, inspectFov, aspect, cacheRef, mobile);

  return { buildingFit, roofPos, roofLook, inspectFov, cacheRef };
}

export function alignRoofOnlyToBuildingInspect(
  roofOnly,
  building,
  buildingFit,
  roofPos,
  roofLook,
  inspectFov,
  aspect,
  cacheRef
) {
  prepareMaterials(roofOnly);

  roofOnly.position.set(0, 0, 0);
  roofOnly.rotation.set(0, 0, 0);
  roofOnly.scale.set(1, 1, 1);
  roofOnly.updateMatrixWorld(true);

  roofOnly.position.sub(buildingFit.initialCenter);
  roofOnly.scale.setScalar(buildingFit.fitScale);
  roofOnly.updateMatrixWorld(true);
  roofOnly.position.sub(buildingFit.fittedCenter);
  roofOnly.rotation.y = buildingFit.finalRotationY;
  roofOnly.updateMatrixWorld(true);

  snapRoofOnlyToRooftopScreen(roofOnly, building, roofPos, roofLook, inspectFov, aspect, cacheRef);

  return {
    pivot: getObjectPivot(roofOnly),
  };
}
