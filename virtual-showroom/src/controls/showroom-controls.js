import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createShowroomControls(camera, canvas, target) {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minPolarAngle = 0.34;
  controls.maxPolarAngle = 0.92;
  const initialDistance = camera.position.distanceTo(target);
  controls.minDistance = Math.max(1, initialDistance * 0.22);
  controls.maxDistance = initialDistance;
  controls.target.copy(target);
  controls.update();
  return controls;
}
