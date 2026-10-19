import * as THREE from 'three';
import { buildPipeTopology } from './pipe-topology.js';
import { FLOW_FOCUS, createContextFocus } from './flow-focus.js';
import { createAirflowSmoke } from './airflow-smoke.js';

export function createFlowVisuals(building, city) {
  const topology = buildPipeTopology(building);
  const enabled = { value: 0 };
  const time = { value: 0 };
  const color = { value: new THREE.Color('#47aaff') };
  const weights = { value: new Float32Array(6) };
  const related = { value: new THREE.Vector4() };
  const targetRelated = new THREE.Vector4();
  const targetColor = color.value.clone();
  let selected = 0, visible = false;
  const resources = [];
  const bounds = Array.from({ length: 6 }, () => new THREE.Box3());
  const identificationCells = Array.from({ length: 6 }, () => new Map());
  const localPoint = new THREE.Vector3();
  const inverse = building.matrixWorld.clone().invert();
  for (const { node, renderData } of topology.meshes) {
    const positions = node.geometry.getAttribute('position');
    const transform = inverse.clone().multiply(node.matrixWorld);
    const used = new Set(node.geometry.index.array);
    for (const i of used) {
      const mask = renderData[i * 4];
      if (!mask) continue;
      localPoint.fromBufferAttribute(positions, i).applyMatrix4(transform);
      for (let step = 0; step < 6; step++) if (mask & (1 << step)) {
        bounds[step].expandByPoint(localPoint);
        const key = [localPoint.x, localPoint.y, localPoint.z].map(n => Math.floor(n / 4)).join(',');
        const cells = identificationCells[step];
        if (!cells.has(key)) cells.set(key, new THREE.Box3());
        cells.get(key).expandByPoint(localPoint);
      }
    }
    const previousAttribute = node.geometry.getAttribute('flowSurface');
    node.geometry.setAttribute('flowSurface', new THREE.BufferAttribute(renderData, 4));
    const original = node.material;
    const materials = (Array.isArray(original) ? original : [original]).map((source) => {
      const material = source.clone();
      material.onBeforeCompile = (shader) => {
        shader.uniforms.flowEnabled = enabled;
        shader.uniforms.flowTime = time;
        shader.uniforms.flowColor = color;
        shader.uniforms.flowWeights = weights;
        shader.uniforms.flowRelated = related;
        shader.vertexShader = 'attribute vec4 flowSurface;\nuniform float flowWeights[6];\nuniform vec4 flowRelated;\nvarying vec4 vFlowSurface;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
          #include <begin_vertex>
          float activeWeight = 0.0;
          for (int i = 0; i < 6; i++) activeWeight += mod(floor(flowSurface.x / exp2(float(i))), 2.0) * flowWeights[i];
          float related = 0.0;
          for (int i = 0; i < 4; i++) related += float(abs(flowSurface.z - float(i + 1)) < 0.1) * flowRelated[i];
          float flowDistance = flowSurface.y * (1.0 - 2.0 * flowSurface.w * flowWeights[5]);
          vFlowSurface = vec4(flowDistance, clamp(activeWeight, 0.0, 1.0), clamp(related, 0.0, 1.0),
            float(flowSurface.x > 0.5));`);
        shader.fragmentShader = 'uniform float flowEnabled;\nuniform float flowTime;\nuniform vec3 flowColor;\nvarying vec4 vFlowSurface;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
          #include <emissivemap_fragment>
          float membership = smoothstep(0.35, 0.8, vFlowSurface.y) * flowEnabled;
          // Geodesic distance on actual mesh edges, never a free-space spline.
          float wave = pow(0.5 + 0.5 * cos(vFlowSurface.x * 3.2 + flowTime * 3.0), 6.0);
          float signal = membership * (0.22 + 0.78 * wave);
          float base = mix(0.52, 0.38, vFlowSurface.w);
          float prominence = mix(base, 0.74, vFlowSurface.z);
          prominence = mix(prominence, 1.08, vFlowSurface.y);
          diffuseColor.rgb *= mix(1.0, prominence, flowEnabled);
          totalEmissiveRadiance *= mix(1.0, prominence, flowEnabled);
          // Preserve palette identity: color is an emissive accent, never a replacement.
          totalEmissiveRadiance += flowColor * signal * 0.85;
          totalEmissiveRadiance += diffuseColor.rgb * membership * 0.08;`);
      };
      material.customProgramCacheKey = () => 'measured-surface-system-flow-focus-v3';
      return material;
    });
    node.material = Array.isArray(original) ? materials : materials[0];
    resources.push({ node, original, materials, previousAttribute });
  }
  const context = createContextFocus(building, city);
  const airflow = createAirflowSmoke(building);
  const equipmentBounds = identificationCells.flatMap(cells => [...cells.values()]);
  for (let i = 0; i < bounds.length; i++) bounds[i].union(airflow.bounds[i]);
  function restore() {
    enabled.value = 0;
    weights.value.fill(0);
    related.value.set(0, 0, 0, 0);
    for (const r of resources) r.node.material = r.original;
    context.restore();
    airflow.reset();
  }
  restore();
  return {
    addCity(city) { context.addCity(city); },
    summary: topology.summary,
    bounds,
    identificationBounds: identificationCells.map((cells, i) => [...equipmentBounds, ...airflow.identificationBounds[i]]),
    get airflow() { return airflow.state; },
    restartAirflow() { airflow.reset(); },
    setStep(step, index) {
      selected = index;
      airflow.setVisible(visible);
      airflow.setStep(index);
      targetRelated.set(0, 0, 0, 0);
      for (const zone of FLOW_FOCUS[index].relatedZones) targetRelated.setComponent(zone - 1, 1);
      targetColor.set(index === 1 || index === 5 ? '#ff9c4a' : index === 2 || index === 3 ? '#42ecff' : '#47aaff');
    },
    setVisible(value) {
      visible = value;
      airflow.setVisible(value);
      if (value) {
        for (const r of resources) r.node.material = Array.isArray(r.original) ? r.materials : r.materials[0];
        context.attach();
      }
    },
    restore,
    update(dt, reducedMotion, paused = false) {
      const amount = reducedMotion ? 1 : 1 - Math.exp(-dt * 8);
      enabled.value = THREE.MathUtils.lerp(enabled.value, visible ? 1 : 0, amount);
      for (let i = 0; i < 6; i++) weights.value[i] = THREE.MathUtils.lerp(weights.value[i], i === selected ? 1 : 0, amount);
      related.value.lerp(targetRelated, amount);
      color.value.lerp(targetColor, amount);
      context.update(enabled.value);
      airflow.update(dt, reducedMotion, paused);
      if (!paused && !reducedMotion) time.value += dt;
    },
    dispose() {
      airflow.dispose();
      context.dispose();
      for (const resource of resources) {
        resource.node.material = resource.original;
        if (resource.previousAttribute) resource.node.geometry.setAttribute('flowSurface', resource.previousAttribute);
        else resource.node.geometry.deleteAttribute('flowSurface');
        resource.materials.forEach((material) => material.dispose());
      }
    },
  };
}
