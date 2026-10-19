import * as THREE from 'three';
import { FLOW_NETWORKS } from './system-flow-data.js';

// Source palette verified against upper/lower cutaways and physical ports.
const PIPE_COLORS = { 2: 'red', 13: 'cyan', 14: 'light-blue', 15: 'dark-blue',
  16: 'light-green', 17: 'dark-green', 18: 'orange' };
const contains = (v, min, max) => v.every((n, i) => n >= min[i] && n <= max[i]);

export function classifyFlowVertex(palette, position) {
  const [x, h, z] = position;
  const u = (x - z) / Math.SQRT2, v = (x + z) / Math.SQRT2;
  const upper = contains([u,v,h], [24,-24,10.5], [34,-15,13.25]);
  const lower = contains([u,v,h], [-4.7,-24,2.95], [57.6,-12.2,6.35]);
  const pipe = PIPE_COLORS[palette];
  if (pipe) {
    if (upper && [13,14,16,18].includes(palette)) return { network: `upper-${pipe}`, mask: 4, zone: 0 };
    if (lower) {
      if ([2,15].includes(palette)) return { network: `lower-${pipe}`, mask: 8, zone: 4 };
      if ([13,14,16].includes(palette)) return { network: `lower-${pipe}`, mask: 4 | 8, zone: 4 };
      return { network: `lower-${pipe}`, mask: 4 | (u >= 28 && u <= 35 ? 8 : 0), zone: 3 };
    }
    return null;
  }
  if (upper) {
    if (palette === 10) return { network: 'supply', mask: 16, zone: 1 };
    if (palette === 12) return { network: 'supply', mask: 1, zone: 1 };
    const unit = u <= 26.6 || u >= 31.4;
    if ([3,5].includes(palette) && unit && h >= 11.75 && v >= -23.25 && v <= -16.6) {
      return { network: 'supply', mask: v < -18.8 ? 1 | 16 : 16, zone: 1 };
    }
    return null;
  }
  if (!lower) return null;
  if (palette === 3 && contains([u,v,h], [29.3,-20.6,2.95], [34.5,-19.6,4.8])) {
    return { network: 'room-equipment', mask: 8, zone: 4 };
  }
  const side = u < 18 ? 'left' : u > 38 ? 'right' : null;
  if (!side) return null;
  const housing = side === 'left'
    ? contains([u,v,h], [-4.05,-23.3,4.05], [-0.35,-21.1,5.4])
    : contains([u,v,h], [38.85,-23.3,4.05], [42.6,-21.1,5.4]);
  if (palette === 9 || palette === 5 || palette === 3 && housing) {
    return { network: `extract-${side}`, mask: housing ? 2 | 32 : 2, zone: housing ? 2 : 0 };
  }
  if (palette === 11 && v < -21 && u < (side === 'left' ? -3.8 : 39)) {
    return { network: `extract-${side}`, mask: 32, zone: 2 };
  }
  return null;
}

class MinHeap {
  items = [];
  push(node, distance) {
    const item = { node, distance };
    let i = this.items.length;
    this.items.push(item);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].distance <= distance) break;
      this.items[i] = this.items[parent]; i = parent;
    }
    this.items[i] = item;
  }
  pop() {
    const first = this.items[0], last = this.items.pop();
    if (this.items.length) {
      let i = 0;
      while (i * 2 + 1 < this.items.length) {
        let next = i * 2 + 1;
        if (next + 1 < this.items.length && this.items[next + 1].distance < this.items[next].distance) next++;
        if (last.distance <= this.items[next].distance) break;
        this.items[i] = this.items[next]; i = next;
      }
      this.items[i] = last;
    }
    return first;
  }
}

export function buildPipeTopology(building) {
  building.updateWorldMatrix(true, true);
  const inverse = building.matrixWorld.clone().invert();
  const graphs = new Map(), meshes = [];
  const point = new THREE.Vector3();
  building.traverse((node) => {
    if (!node.isMesh || node.isInstancedMesh || node.name === 'heatPumpEnclosureWall') return;
    const geometry = node.geometry, positions = geometry?.attributes.position, uv = geometry?.attributes.uv;
    if (!positions || !uv || !geometry.index) return;
    const transform = inverse.clone().multiply(node.matrixWorld);
    const records = new Array(positions.count);
    const renderData = new Float32Array(positions.count * 4);
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(transform);
      const palette = Math.round((uv.getX(i) - 0.015625) * 32);
      const classification = classifyFlowVertex(palette, [point.x,point.y,point.z]);
      if (!classification) continue;
      let graph = graphs.get(classification.network);
      if (!graph) {
        graph = { vertices: [], weld: new Map(), components: 0 };
        graphs.set(classification.network, graph);
      }
      // Weld quantized coincident seams only. No proximity edges between pipes.
      const key = [point.x,point.y,point.z].map((v) => Math.round(v / 0.006)).join(',');
      let id = graph.weld.get(key);
      if (id === undefined) {
        id = graph.vertices.length;
        graph.weld.set(key, id);
        graph.vertices.push({ position: point.clone(), edges: new Set(), distance: Infinity });
      }
      records[i] = { graph, id, ...classification };
      renderData[i * 4] = classification.mask;
      renderData[i * 4 + 2] = classification.zone;
    }
    const index = geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      const a = records[index.getX(i)], b = records[index.getX(i+1)], c = records[index.getX(i+2)];
      if (!a || !b || !c || a.graph !== b.graph || a.graph !== c.graph) continue;
      a.graph.vertices[a.id].edges.add(b.id).add(c.id);
      a.graph.vertices[b.id].edges.add(a.id).add(c.id);
      a.graph.vertices[c.id].edges.add(a.id).add(b.id);
    }
    meshes.push({ node, records, renderData });
  });
  const heap = new MinHeap(), summary = [];
  for (const [name, graph] of graphs) {
    const seeds = FLOW_NETWORKS[name].seeds.map((p) => new THREE.Vector3(...p));
    const visited = new Uint8Array(graph.vertices.length);
    for (let i = 0; i < graph.vertices.length; i++) {
      if (visited[i]) continue;
      // Each disconnected piece is independent: empty gaps stay unanimated.
      const component = [i]; visited[i] = 1;
      for (let j = 0; j < component.length; j++) {
        for (const other of graph.vertices[component[j]].edges) {
          if (!visited[other]) { visited[other] = 1; component.push(other); }
        }
      }
      graph.components++;
      for (const seed of seeds) {
        let nearest = component[0], nearestDistance = Infinity;
        for (const id of component) {
          const d = graph.vertices[id].position.distanceToSquared(seed);
          if (d < nearestDistance) { nearest = id; nearestDistance = d; }
        }
        const offset = Math.sqrt(nearestDistance);
        if (offset < graph.vertices[nearest].distance) {
          graph.vertices[nearest].distance = offset;
          heap.push(nearest, offset);
        }
      }
      while (heap.items.length) {
        const item = heap.pop(), vertex = graph.vertices[item.node];
        if (item.distance !== vertex.distance) continue;
        for (const next of vertex.edges) {
          const other = graph.vertices[next];
          const distance = item.distance + vertex.position.distanceTo(other.position);
          if (distance < other.distance) { other.distance = distance; heap.push(next, distance); }
        }
      }
    }
    summary.push({ network: name, vertices: graph.vertices.length, components: graph.components });
  }
  for (const mesh of meshes) {
    mesh.records.forEach((record, i) => {
      if (record) {
        mesh.renderData[i * 4 + 1] = record.graph.vertices[record.id].distance;
        mesh.renderData[i * 4 + 3] = record.network === 'extract-right' && (record.mask & 32) ? 1 : 0;
      }
    });
    delete mesh.records;
  }
  return { meshes, summary };
}
