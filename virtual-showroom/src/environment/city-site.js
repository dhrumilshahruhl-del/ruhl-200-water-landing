import * as THREE from 'three';

export function createCitySite(heroBox) {
  const size = heroBox.getSize(new THREE.Vector3());
  const center = heroBox.getCenter(new THREE.Vector3());
  const span = Math.max(size.x, size.z);
  const roadWidth = span * 0.24;
  const sidewalkWidth = span * 0.06;
  const setback = span * 0.14 + sidewalkWidth;
  return {
    size, center, span, roadWidth, sidewalkWidth,
    groundY: heroBox.min.y - 0.08,
    groundSize: span * 14,
    west: heroBox.min.x - setback - roadWidth / 2,
    east: heroBox.max.x + setback + roadWidth / 2,
    north: heroBox.min.z - setback - roadWidth / 2,
    south: heroBox.max.z + setback + roadWidth / 2,
  };
}

export function roadRectangles(site) {
  const halfWidth = site.roadWidth / 2;
  const halfLength = site.groundSize * 0.46;
  return [
    ...[site.west, site.east].map((x) => ({
      minX: x - halfWidth, maxX: x + halfWidth,
      minZ: site.center.z - halfLength, maxZ: site.center.z + halfLength,
    })),
    ...[site.north, site.south].map((z) => ({
      minX: site.center.x - halfLength, maxX: site.center.x + halfLength,
      minZ: z - halfWidth, maxZ: z + halfWidth,
    })),
  ];
}

export function footprint(box, margin = 0) {
  return { minX: box.min.x - margin, maxX: box.max.x + margin,
    minZ: box.min.z - margin, maxZ: box.max.z + margin };
}

export function overlaps(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

export function positionCityBuilding(instance, item, site, heroBox) {
  const bounds = new THREE.Box3().setFromObject(instance);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const outside = site.roadWidth / 2 + site.sidewalkWidth;
  let x;
  if (Math.abs(item.x) > 1) {
    x = item.x < 0 ? site.west - outside - size.x / 2 : site.east + outside + size.x / 2;
  } else {
    const minX = site.west + outside + size.x / 2;
    const maxX = site.east - outside - size.x / 2;
    x = THREE.MathUtils.clamp(site.center.x + item.x * site.span * 0.3, minX, maxX);
  }
  const z = item.z < 0 ? site.north - outside - size.z / 2 : site.south + outside + size.z / 2;
  instance.position.set(x - center.x, heroBox.min.y - 0.06 - bounds.min.y, z - center.z);
  instance.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(instance);
}
