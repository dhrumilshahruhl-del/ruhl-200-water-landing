/**
 * Procedural commercial rooftop retrofit — lightweight engineering visualization.
 * Parent group: rooftopRetrofitGroup
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const rooftopRetrofitConfig = {
  position: { x: 0, y: 0.015, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
  /** Parapet clearance — fraction of roof length/depth (0.05 ≈ 5%) */
  roofInset: 0.05,
};

const COLORS = {
  galv: 0xb5bcc4,
  galvDark: 0x8b949e,
  panel: 0xd1d8de,
  panelSeam: 0xa8b0b8,
  duct: 0xa3adb6,
  ductFlange: 0x939da6,
  louver: 0x9aa3ab,
  fanBlade: 0x7a828a,
  insul: 0xf0f2f4,
  insulJacket: 0xdce1e6,
  pipeWarm: 0xb85c4a,
  pipeCool: 0x2f4a6a,
  curb: 0x969ca3,
  grate: 0x8a9199,
  accent: 0x00375a,
};

/** Design pad (meters) — spans both roof wings around penthouse void */
const DESIGN_PAD = { width: 3.35, depth: 1.75 };

let sharedMaterials = null;
const geometryCache = new Map();

function geo(THREE, key, factory) {
  if (!geometryCache.has(key)) geometryCache.set(key, factory());
  return geometryCache.get(key);
}

function getMaterials(THREE) {
  if (sharedMaterials) return sharedMaterials;
  sharedMaterials = {
    galv: new THREE.MeshStandardMaterial({ color: COLORS.galv, metalness: 0.62, roughness: 0.38 }),
    galvDark: new THREE.MeshStandardMaterial({ color: COLORS.galvDark, metalness: 0.58, roughness: 0.4 }),
    panel: new THREE.MeshStandardMaterial({ color: COLORS.panel, metalness: 0.42, roughness: 0.46 }),
    seam: new THREE.MeshStandardMaterial({ color: COLORS.panelSeam, metalness: 0.35, roughness: 0.52 }),
    duct: new THREE.MeshStandardMaterial({ color: COLORS.duct, metalness: 0.48, roughness: 0.44 }),
    flange: new THREE.MeshStandardMaterial({ color: COLORS.ductFlange, metalness: 0.55, roughness: 0.42 }),
    louver: new THREE.MeshStandardMaterial({ color: COLORS.louver, metalness: 0.52, roughness: 0.48 }),
    fanBlade: new THREE.MeshStandardMaterial({ color: COLORS.fanBlade, metalness: 0.65, roughness: 0.32 }),
    insul: new THREE.MeshStandardMaterial({ color: COLORS.insul, metalness: 0.08, roughness: 0.78 }),
    insulJacket: new THREE.MeshStandardMaterial({ color: COLORS.insulJacket, metalness: 0.15, roughness: 0.65 }),
    pipeWarm: new THREE.MeshStandardMaterial({ color: COLORS.pipeWarm, metalness: 0.28, roughness: 0.52 }),
    pipeCool: new THREE.MeshStandardMaterial({ color: COLORS.pipeCool, metalness: 0.28, roughness: 0.52 }),
    curb: new THREE.MeshStandardMaterial({ color: COLORS.curb, metalness: 0.35, roughness: 0.58 }),
    grate: new THREE.MeshStandardMaterial({ color: COLORS.grate, metalness: 0.25, roughness: 0.62 }),
  };
  return sharedMaterials;
}

function mesh(THREE, geometry, material) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

function addCurb(parent, THREE, mats, width, depth, height = 0.09) {
  const curb = mesh(
    THREE,
    geo(THREE, `curb_${width}_${depth}_${height}`, () => new THREE.BoxGeometry(width, height, depth)),
    mats.curb
  );
  curb.position.y = height / 2;
  parent.add(curb);
  return height;
}

function addPanelSeams(parent, THREE, mats, width, height, depth, nx, ny) {
  for (let i = 1; i < nx; i += 1) {
    const seam = mesh(
      THREE,
      geo(THREE, 'seam_v', () => new THREE.BoxGeometry(0.008, height * 0.92, depth * 1.002)),
      mats.seam
    );
    seam.position.set(-width / 2 + (width / nx) * i, height / 2, 0);
    parent.add(seam);
  }
  for (let j = 1; j < ny; j += 1) {
    const seam = mesh(
      THREE,
      geo(THREE, 'seam_h', () => new THREE.BoxGeometry(width * 1.002, 0.008, depth * 1.002)),
      mats.seam
    );
    seam.position.set(0, (height / ny) * j, 0);
    parent.add(seam);
  }
}

function addLouverBank(parent, THREE, mats, width, height, depth, cols, rows) {
  const slatW = width / cols;
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      const slat = mesh(
        THREE,
        geo(THREE, 'louver_slat', () => new THREE.BoxGeometry(slatW * 0.82, height / rows * 0.55, depth * 0.06)),
        mats.louver
      );
      slat.position.set(
        -width / 2 + slatW * (c + 0.5),
        height / rows * (r + 0.45),
        depth / 2 + 0.02
      );
      slat.rotation.x = -0.35;
      parent.add(slat);
    }
  }
}

function createPropellerFan(THREE, mats, radius, spinSpeed = 5.5, spinAxis = 'y') {
  const fan = new THREE.Group();
  fan.name = 'fanRotor';
  fan.userData.spin = true;
  fan.userData.spinSpeed = spinSpeed;
  fan.userData.spinAxis = spinAxis;

  const hub = mesh(
    THREE,
    geo(THREE, 'fan_hub', () => new THREE.CylinderGeometry(radius * 0.12, radius * 0.12, 0.035, 10)),
    mats.galvDark
  );
  fan.add(hub);

  const bladeGeo = geo(THREE, `blade_${radius}`, () => new THREE.BoxGeometry(radius * 0.88, 0.012, radius * 0.14));
  for (let i = 0; i < 5; i += 1) {
    const blade = mesh(THREE, bladeGeo, mats.fanBlade);
    blade.rotation.y = (i / 5) * Math.PI * 2;
    blade.position.y = 0.008;
    fan.add(blade);
  }

  const ring = mesh(
    THREE,
    geo(THREE, `fan_ring_${radius}`, () => new THREE.TorusGeometry(radius * 0.92, 0.012, 6, 24)),
    mats.galvDark
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.01;
  fan.add(ring);

  return fan;
}

function addRectDuct(parent, THREE, mats, length, w, h, x, y, z, rotY = 0) {
  const duct = mesh(
    THREE,
    geo(THREE, `duct_${length}_${w}_${h}`, () => new THREE.BoxGeometry(length, h, w)),
    mats.duct
  );
  duct.position.set(x, y, z);
  duct.rotation.y = rotY;
  parent.add(duct);
  const flangeScale = 1.06;
  [-1, 1].forEach((side) => {
    const flange = mesh(
      THREE,
      geo(THREE, `flange_${w}_${h}`, () => new THREE.BoxGeometry(0.02, h * flangeScale, w * flangeScale)),
      mats.flange
    );
    flange.position.set(x + (length / 2) * side, y, z);
    flange.rotation.y = rotY;
    parent.add(flange);
  });
}

function addInsulatedPipeRun(parent, THREE, mats, length, radius, x, y, z, axis = 'x', warm = true) {
  const pipeMat = warm ? mats.pipeWarm : mats.pipeCool;
  const jacketMat = mats.insulJacket;
  const pipe = mesh(
    THREE,
    geo(THREE, `pipe_${radius}`, () => new THREE.CylinderGeometry(radius, radius, length, 10)),
    pipeMat
  );
  const jacket = mesh(
    THREE,
    geo(THREE, `jacket_${radius}`, () => new THREE.CylinderGeometry(radius * 1.45, radius * 1.45, length, 10)),
    jacketMat
  );
  if (axis === 'x') {
    pipe.rotation.z = Math.PI / 2;
    jacket.rotation.z = Math.PI / 2;
  }
  pipe.position.set(x, y, z);
  jacket.position.set(x, y, z);
  parent.add(pipe, jacket);
}

function createERV(THREE, mats) {
  const g = new THREE.Group();
  g.name = 'erv';
  const w = 0.72;
  const d = 0.52;
  const h = 0.38;
  const curbH = addCurb(g, THREE, mats, w + 0.08, d + 0.08, 0.07);

  const housing = mesh(THREE, geo(THREE, `erv_h_${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d)), mats.galv);
  housing.position.y = curbH + h / 2;
  g.add(housing);
  addPanelSeams(g, THREE, mats, w, h, d, 3, 2);

  const oaHood = mesh(THREE, geo(THREE, 'erv_hood', () => new THREE.BoxGeometry(0.28, 0.22, 0.14)), mats.panel);
  oaHood.position.set(-w * 0.28, curbH + h * 0.55, d / 2 + 0.05);
  g.add(oaHood);
  const oaLouvers = new THREE.Group();
  oaLouvers.position.copy(oaHood.position);
  addLouverBank(oaLouvers, THREE, mats, 0.24, 0.18, 0.02, 4, 3);
  g.add(oaLouvers);

  const eaHood = mesh(THREE, geo(THREE, 'erv_hood_ea', () => new THREE.BoxGeometry(0.26, 0.2, 0.12)), mats.panel);
  eaHood.position.set(w * 0.28, curbH + h * 0.55, d / 2 + 0.05);
  g.add(eaHood);

  const door = mesh(THREE, geo(THREE, 'erv_door', () => new THREE.BoxGeometry(0.2, 0.28, 0.015)), mats.galvDark);
  door.position.set(0, curbH + h * 0.42, -d / 2 - 0.01);
  g.add(door);

  const accessLatch = mesh(THREE, geo(THREE, 'latch', () => new THREE.BoxGeometry(0.04, 0.08, 0.02)), mats.galvDark);
  accessLatch.position.set(0.06, curbH + h * 0.42, -d / 2 - 0.02);
  g.add(accessLatch);

  g.userData.anchor = new THREE.Vector3(0, curbH + h + 0.05, 0);
  g.userData.flowPorts = {
    outdoorAirIn: new THREE.Vector3(-w * 0.28, curbH + h * 0.55, d / 2 + 0.05),
    core: new THREE.Vector3(0, curbH + h / 2, 0),
    exhaustAirOut: new THREE.Vector3(w * 0.28, curbH + h * 0.55, d / 2 + 0.05),
  };
  g.userData.revealOrder = 1;
  return g;
}

function createHeatPumpBank(THREE, mats) {
  const g = new THREE.Group();
  g.name = 'heatPumpBank';
  const units = 2;
  const spacing = 0.58;
  const uw = 0.48;
  const ud = 0.48;
  const uh = 0.34;

  for (let i = 0; i < units; i += 1) {
    const unit = new THREE.Group();
    const curbH = addCurb(unit, THREE, mats, uw + 0.06, ud + 0.06, 0.06);
    const cabinet = mesh(
      THREE,
      geo(THREE, `hp_cab_${uw}_${uh}_${ud}`, () => new THREE.BoxGeometry(uw, uh, ud)),
      mats.galv
    );
    cabinet.position.y = curbH + uh / 2;
    unit.add(cabinet);
    addLouverBank(unit, THREE, mats, uw * 0.85, uh * 0.7, 0.02, 5, 4);
    const fan = createPropellerFan(THREE, mats, 0.14, 7.2, 'y');
    fan.position.set(0, curbH + uh + 0.04, 0);
    unit.add(fan);
    const rail = mesh(THREE, geo(THREE, 'hp_rail', () => new THREE.BoxGeometry(uw + 0.04, 0.035, 0.05)), mats.galvDark);
    rail.position.set(0, curbH + 0.02, -ud / 2 - 0.02);
    unit.add(rail);
    unit.position.x = (i - (units - 1) / 2) * spacing;
    g.add(unit);
  }

  g.userData.anchor = new THREE.Vector3(0, 0.48, 0);
  g.userData.flowPorts = {
    energyIn: new THREE.Vector3(-0.52, 0.28, 0.02),
    hydronicPort: new THREE.Vector3(0.14, 0.2, -0.1),
  };
  g.userData.revealOrder = 2;
  return g;
}

function createAHU(THREE, mats) {
  const g = new THREE.Group();
  g.name = 'ahu';
  const w = 0.95;
  const d = 0.58;
  const h = 0.42;
  const curbH = addCurb(g, THREE, mats, w + 0.1, d + 0.08, 0.07);

  const body = mesh(THREE, geo(THREE, `ahu_${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d)), mats.panel);
  body.position.y = curbH + h / 2;
  g.add(body);
  addPanelSeams(g, THREE, mats, w, h, d, 4, 2);

  const filterDoor = mesh(THREE, geo(THREE, 'ahu_door', () => new THREE.BoxGeometry(0.22, 0.3, 0.012)), mats.galvDark);
  filterDoor.position.set(-w * 0.32, curbH + h * 0.4, -d / 2 - 0.01);
  g.add(filterDoor);

  const plenum = mesh(THREE, geo(THREE, 'ahu_plenum', () => new THREE.BoxGeometry(0.38, 0.28, 0.38)), mats.duct);
  plenum.position.set(-w / 2 - 0.16, curbH + h * 0.55, 0);
  g.add(plenum);

  addRectDuct(g, THREE, mats, 0.55, 0.28, 0.22, -w / 2 - 0.42, curbH + h * 0.55, 0);

  const fan = createPropellerFan(THREE, mats, 0.11, 6.5, 'y');
  fan.position.set(w * 0.15, curbH + h * 0.72, 0);
  g.add(fan);

  g.userData.anchor = new THREE.Vector3(-0.05, curbH + h + 0.06, 0);
  g.userData.flowPorts = {
    conditioned: new THREE.Vector3(w * 0.15, curbH + h * 0.72, 0),
    plenum: new THREE.Vector3(-w / 2 - 0.16, curbH + h * 0.55, 0),
    supplyMouth: new THREE.Vector3(-w / 2 - 0.42 - 0.275, curbH + h * 0.55, 0),
  };
  g.userData.revealOrder = 3;
  return g;
}

function createDuctworkAndExhaust(THREE, mats) {
  const g = new THREE.Group();
  g.name = 'ductwork';

  addRectDuct(g, THREE, mats, 0.75, 0.24, 0.2, 0.15, 0.32, -0.08);
  addRectDuct(g, THREE, mats, 0.35, 0.24, 0.2, -0.35, 0.32, -0.08, Math.PI / 2);

  const stack = mesh(
    THREE,
    geo(THREE, 'exhaust_stack', () => new THREE.BoxGeometry(0.22, 0.42, 0.22)),
    mats.duct
  );
  stack.position.set(0.82, 0.38, 0.38);
  g.add(stack);

  const fanHousing = mesh(
    THREE,
    geo(THREE, 'ex_fan_h', () => new THREE.CylinderGeometry(0.14, 0.14, 0.12, 12)),
    mats.galv
  );
  fanHousing.position.set(0.82, 0.64, 0.38);
  g.add(fanHousing);

  const exhaustFan = createPropellerFan(THREE, mats, 0.1, 8, 'y');
  exhaustFan.position.set(0.82, 0.7, 0.38);
  g.add(exhaustFan);

  const weatherCap = mesh(
    THREE,
    geo(THREE, 'ex_cap', () => new THREE.ConeGeometry(0.16, 0.08, 4)),
    mats.galvDark
  );
  weatherCap.position.set(0.82, 0.78, 0.38);
  g.add(weatherCap);

  g.userData.anchor = new THREE.Vector3(0.82, 0.64, 0.38);
  g.userData.flowPorts = {
    header: new THREE.Vector3(-0.35, 0.32, -0.08),
    stackIn: new THREE.Vector3(0.82, 0.38, 0.38),
    stackOut: new THREE.Vector3(0.82, 0.78, 0.38),
  };
  g.userData.revealOrder = 1;
  return g;
}

function createHydronics(THREE, mats) {
  const g = new THREE.Group();
  g.name = 'hydronics';

  addInsulatedPipeRun(g, THREE, mats, 0.85, 0.028, 0.05, 0.2, 0.22, 'x', true);
  addInsulatedPipeRun(g, THREE, mats, 0.85, 0.024, 0.05, 0.14, 0.08, 'x', false);

  const pumpBody = mesh(
    THREE,
    geo(THREE, 'pump_volute', () => new THREE.CylinderGeometry(0.07, 0.09, 0.12, 12)),
    mats.galvDark
  );
  pumpBody.rotation.z = Math.PI / 2;
  pumpBody.position.set(-0.28, 0.17, 0.22);
  g.add(pumpBody);

  const motor = mesh(
    THREE,
    geo(THREE, 'pump_motor', () => new THREE.CylinderGeometry(0.045, 0.045, 0.14, 10)),
    mats.galv
  );
  motor.rotation.x = Math.PI / 2;
  motor.position.set(-0.38, 0.17, 0.22);
  g.add(motor);

  const valveBody = mesh(THREE, geo(THREE, 'valve', () => new THREE.BoxGeometry(0.08, 0.08, 0.08)), mats.galvDark);
  valveBody.position.set(-0.02, 0.2, 0.22);
  g.add(valveBody);
  const handwheel = mesh(
    THREE,
    geo(THREE, 'wheel', () => new THREE.CylinderGeometry(0.05, 0.05, 0.015, 12)),
    mats.galvDark
  );
  handwheel.position.set(-0.02, 0.26, 0.22);
  g.add(handwheel);

  for (let i = 0; i < 3; i += 1) {
    const support = mesh(
      THREE,
      geo(THREE, 'pipe_support', () => new THREE.BoxGeometry(0.05, 0.1, 0.05)),
      mats.galvDark
    );
    support.position.set(-0.15 + i * 0.28, 0.1, 0.22);
    g.add(support);
  }

  g.userData.anchor = new THREE.Vector3(0, 0.28, 0.22);
  g.userData.flowPorts = {
    supply: new THREE.Vector3(0.475, 0.2, 0.22),
    return: new THREE.Vector3(-0.375, 0.14, 0.08),
  };
  g.userData.revealOrder = 4;
  return g;
}

function createCoolingTower(THREE, mats) {
  const g = new THREE.Group();
  g.name = 'coolingTower';
  const curbH = addCurb(g, THREE, mats, 0.52, 0.52, 0.06);

  const basin = mesh(
    THREE,
    geo(THREE, 'ct_basin', () => new THREE.BoxGeometry(0.48, 0.18, 0.48)),
    mats.galv
  );
  basin.position.y = curbH + 0.09;
  g.add(basin);

  const louverBand = mesh(
    THREE,
    geo(THREE, 'ct_louver_band', () => new THREE.CylinderGeometry(0.22, 0.24, 0.14, 14, 1, true)),
    mats.louver
  );
  louverBand.position.y = curbH + 0.28;
  g.add(louverBand);

  const fanCowl = mesh(
    THREE,
    geo(THREE, 'ct_cowl', () => new THREE.CylinderGeometry(0.16, 0.2, 0.12, 14)),
    mats.panel
  );
  fanCowl.position.y = curbH + 0.42;
  g.add(fanCowl);

  const fan = createPropellerFan(THREE, mats, 0.12, 4.5, 'y');
  fan.position.set(0, curbH + 0.46, 0);
  g.add(fan);

  g.userData.anchor = new THREE.Vector3(0, curbH + 0.52, 0);
  g.userData.revealOrder = 5;
  g.userData.conditional = true;
  return g;
}

function createWalkways(THREE, mats, clearHalfX) {
  const g = new THREE.Group();
  g.name = 'walkways';

  const leftRun = mesh(
    THREE,
    geo(THREE, 'walk_left', () => new THREE.BoxGeometry(1.35, 0.025, 0.42)),
    mats.grate
  );
  leftRun.position.set(-clearHalfX - 0.72, 0.012, 0.05);
  g.add(leftRun);

  const rightRun = mesh(
    THREE,
    geo(THREE, 'walk_right', () => new THREE.BoxGeometry(1.35, 0.025, 0.42)),
    mats.grate
  );
  rightRun.position.set(clearHalfX + 0.72, 0.012, 0.05);
  g.add(rightRun);

  const spine = mesh(
    THREE,
    geo(THREE, 'walk_spine', () => new THREE.BoxGeometry(clearHalfX * 2 + 0.5, 0.025, 0.28)),
    mats.grate
  );
  spine.position.set(0, 0.012, -0.52);
  g.add(spine);

  return g;
}

/** Shared colors for pipes, particles, legend, and on-path flow labels. */
export const FLOW_PALETTE = {
  freshAir: { hex: '#3b82c4', three: 0x3b82c4, arrowThree: 0x2563ab, label: 'Fresh outdoor air', legend: 'Fresh outdoor air', tagFg: '#ffffff' },
  exhaustAir: { hex: '#546E7A', three: 0x546e7a, arrowThree: 0x3d4f59, label: 'Exhaust air out', legend: 'Exhaust air', tagFg: '#ffffff' },
  recoveredEnergy: { hex: '#fcbe00', three: 0xfcbe00, arrowThree: 0xb8860b, label: 'Recovered energy', legend: 'Recovered energy', tagFg: '#1e293b' },
  warmWater: { hex: '#c45c4c', three: 0xc45c4c, arrowThree: 0x9a3d32, label: 'Warm-water loop', legend: 'Warm-water loop', tagFg: '#ffffff' },
  supplyAir: { hex: '#4a9b6e', three: 0x4a9b6e, arrowThree: 0x2f6b47, label: 'Supply air to building', legend: 'Conditioned supply air', tagFg: '#ffffff' },
};

/** Core air + hydronic paths shown in the scroll story (keeps the diagram readable). */
export const PRIMARY_FLOW_IDS = ['freshAir', 'exhaustAir', 'recoveredEnergy', 'supplyAir', 'warmWater'];

const FLOW_STYLE = {
  freshAir: { speed: 0.11, pipeRadius: 0.052, radial: 12 },
  exhaustAir: { speed: 0.12, pipeRadius: 0.048, radial: 12 },
  recoveredEnergy: { speed: 0.1, pipeRadius: 0.044, radial: 12 },
  warmWater: { speed: 0.085, pipeRadius: 0.042, radial: 14 },
  supplyAir: { speed: 0.105, pipeRadius: 0.046, radial: 12 },
};

const FLOW_CORE_INNER = 0.58;

function flowTintWhite(threeColor, mix = 0.2) {
  const c = new THREE.Color(threeColor);
  c.lerp(new THREE.Color(0xffffff), 1 - mix);
  return c.getHex();
}

function buildFlowAnchorsFromLayout(layout, wingX, wingZ) {
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const flowPort = (equipName, portKey) => {
    let group = null;
    layout.traverse((o) => {
      if (o.name === equipName) group = o;
    });
    const local = group?.userData.flowPorts?.[portKey];
    if (!group || !local) return v(0, 0.4, 0);
    return v(group.position.x + local.x, group.position.y + local.y, group.position.z + local.z);
  };

  const ervOaHood = flowPort('erv', 'outdoorAirIn');
  const ervCore = flowPort('erv', 'core');
  const ervEaHood = flowPort('erv', 'exhaustAirOut');

  const hpEnergyIn = flowPort('heatPumpBank', 'energyIn');
  const hpHydronicPort = flowPort('heatPumpBank', 'hydronicPort');

  const ahuConditioned = flowPort('ahu', 'conditioned');
  const ahuPlenum = flowPort('ahu', 'plenum');
  const ahuSupplyMouth = flowPort('ahu', 'supplyMouth');
  const buildingSupply = v(ahuSupplyMouth.x, 0.14, ahuSupplyMouth.z - 0.32);

  const ductHeader = flowPort('ductwork', 'header');
  const exhaustStackIn = flowPort('ductwork', 'stackIn');
  const exhaustCap = flowPort('ductwork', 'stackOut');
  const exhaustFan = v(exhaustCap.x, exhaustCap.y - 0.14, exhaustCap.z);
  const exhaustDischarge = v(exhaustCap.x + 0.06, exhaustCap.y, exhaustCap.z + 0.4);

  const hydroSupply = flowPort('hydronics', 'supply');
  const hydroReturn = flowPort('hydronics', 'return');

  const outdoorFresh = v(-wingX - 0.78, ervOaHood.y, ervOaHood.z);
  const waterRunY = 0.4;
  const ductToStack = v(exhaustStackIn.x, ductHeader.y, ductHeader.z);

  return {
    freshAir: [
      outdoorFresh,
      v(ervOaHood.x - 0.16, ervOaHood.y, ervOaHood.z),
      ervOaHood,
      ervCore,
    ],
    exhaustAir: [
      ervEaHood,
      v(ductHeader.x, ervEaHood.y, ervEaHood.z),
      ductHeader,
      ductToStack,
      exhaustStackIn,
      v(exhaustStackIn.x, exhaustFan.y, exhaustStackIn.z),
      exhaustFan,
      exhaustCap,
      exhaustDischarge,
    ],
    recoveredEnergy: [
      ervCore,
      v(ervCore.x, ervCore.y + 0.16, ervCore.z),
      v(hpEnergyIn.x + 0.2, ervCore.y + 0.16, ervCore.z),
      v(hpEnergyIn.x + 0.2, hpEnergyIn.y + 0.06, hpEnergyIn.z),
      hpEnergyIn,
    ],
    supplyAir: [ahuConditioned, ahuPlenum, ahuSupplyMouth, v(ahuSupplyMouth.x, 0.26, ahuSupplyMouth.z), buildingSupply],
    warmWater: [
      hydroSupply,
      v(hydroSupply.x, waterRunY, hydroSupply.z),
      v(hpHydronicPort.x, waterRunY, hydroSupply.z),
      v(hpHydronicPort.x, waterRunY, hpHydronicPort.z),
      hpHydronicPort,
      v(hpHydronicPort.x, waterRunY, hpHydronicPort.z),
      v(hydroReturn.x, waterRunY, hydroReturn.z),
      hydroReturn,
    ],
  };
}

export function createRooftopRetrofitGroup(THREE, roofTopY, fittedSize, penthouseExclusion) {
  const mats = getMaterials(THREE);
  const rooftopRetrofitGroup = new THREE.Group();
  rooftopRetrofitGroup.name = 'rooftopRetrofitGroup';

  const exclusion = penthouseExclusion || {
    halfX: fittedSize.x * 0.14,
    halfZ: fittedSize.z * 0.22,
    centerX: 0,
    centerZ: 0,
  };

  const clearHalfX = exclusion.halfX / Math.max(fittedSize.x / DESIGN_PAD.width, 0.001);
  const scaledClearHalfX = Math.max(0.42, Math.min(0.72, clearHalfX * 0.85));

  const marginX = fittedSize.x * (0.05 + rooftopRetrofitConfig.roofInset);
  const marginZ = fittedSize.z * (0.06 + rooftopRetrofitConfig.roofInset);
  const usableX = fittedSize.x - exclusion.halfX * 2 - marginX * 2;
  const usableZ = fittedSize.z - marginZ * 2;
  const autoScale = Math.min(usableX / DESIGN_PAD.width, usableZ / DESIGN_PAD.depth, 1.28);
  const scale = rooftopRetrofitConfig.scale * autoScale;

  rooftopRetrofitGroup.scale.setScalar(scale);
  rooftopRetrofitGroup.position.set(
    rooftopRetrofitConfig.position.x + exclusion.centerX,
    roofTopY + rooftopRetrofitConfig.position.y,
    rooftopRetrofitConfig.position.z + exclusion.centerZ
  );
  rooftopRetrofitGroup.rotation.set(
    rooftopRetrofitConfig.rotation.x,
    rooftopRetrofitConfig.rotation.y,
    rooftopRetrofitConfig.rotation.z
  );

  const layout = new THREE.Group();
  layout.name = 'layout';

  const wingX = scaledClearHalfX + 0.58;
  const wingZ = 0.14;

  layout.add(createWalkways(THREE, mats, scaledClearHalfX));

  const erv = createERV(THREE, mats);
  erv.position.set(-wingX, 0, wingZ);
  layout.add(erv);

  const heatPumps = createHeatPumpBank(THREE, mats);
  heatPumps.position.set(-wingX + 0.38, 0, -wingZ * 0.85);
  layout.add(heatPumps);

  const ahu = createAHU(THREE, mats);
  ahu.position.set(wingX - 0.12, 0, -wingZ * 0.55);
  layout.add(ahu);

  const ducts = createDuctworkAndExhaust(THREE, mats);
  ducts.position.set(wingX - 0.02, 0, wingZ * 1.05);
  layout.add(ducts);

  const hydronics = createHydronics(THREE, mats);
  hydronics.position.set(wingX - 0.42, 0, wingZ * 0.65);
  layout.add(hydronics);

  const tower = createCoolingTower(THREE, mats);
  tower.position.set(wingX - 0.05, 0, -wingZ * 2.35);
  layout.add(tower);

  layout.scale.setScalar(1.06);

  layout.traverse((obj) => {
    if (obj.isMesh) {
      obj.material = obj.material.clone();
      obj.material.transparent = true;
      obj.material.opacity = 0;
      obj.userData.baseY = obj.position.y;
    }
  });

  rooftopRetrofitGroup.add(layout);
  rooftopRetrofitGroup.userData.flowAnchorsLocal = buildFlowAnchorsFromLayout(layout, wingX, wingZ);
  rooftopRetrofitGroup.userData.penthouseExclusion = exclusion;

  const anchors = collectAnchors(rooftopRetrofitGroup);

  return {
    rooftopRetrofitGroup,
    anchors,
    revealMeshes: collectRevealMeshes(layout),
    spinMeshes: collectSpinMeshes(layout),
  };
}

function collectAnchors(group) {
  const anchors = {};
  group.traverse((obj) => {
    if (obj.userData.anchor && obj.name) anchors[obj.name] = obj;
  });
  return anchors;
}

function collectRevealMeshes(root) {
  const list = [];
  root.traverse((obj) => {
    if (obj.isMesh && obj.material?.opacity !== undefined) list.push(obj);
  });
  return list;
}

function collectSpinMeshes(root) {
  const list = [];
  root.traverse((obj) => {
    if (obj.userData.spin) list.push(obj);
  });
  return list;
}

function localToWorldPoints(group, points) {
  return points.map((p) => group.localToWorld(p.clone()));
}

function dedupePolylinePoints(points, eps = 1e-4) {
  if (!points.length) return [];
  const out = [points[0].clone()];
  for (let i = 1; i < points.length; i += 1) {
    if (points[i].distanceTo(out[out.length - 1]) > eps) out.push(points[i].clone());
  }
  return out;
}

function createFlowPolylinePath(initialPoints) {
  const state = { points: dedupePolylinePoints(initialPoints), segments: [], totalLength: 0 };

  function rebuild() {
    state.segments.length = 0;
    state.totalLength = 0;
    for (let i = 0; i < state.points.length - 1; i += 1) {
      const length = state.points[i].distanceTo(state.points[i + 1]);
      state.segments.push({ i, length, dist0: state.totalLength });
      state.totalLength += length;
    }
  }
  rebuild();

  return {
    get points() {
      return state.points;
    },
    set points(next) {
      state.points = dedupePolylinePoints(next);
      rebuild();
    },
    updateArcLengths() {
      rebuild();
    },
    getPointAt(t, target = new THREE.Vector3()) {
      if (!state.points.length) return target.set(0, 0, 0);
      if (state.totalLength < 1e-6) return target.copy(state.points[0]);
      const d = THREE.MathUtils.clamp(t, 0, 1) * state.totalLength;
      for (let s = 0; s < state.segments.length; s += 1) {
        const seg = state.segments[s];
        if (d <= seg.dist0 + seg.length + 1e-6) {
          const u = seg.length < 1e-6 ? 0 : (d - seg.dist0) / seg.length;
          return target.copy(state.points[seg.i]).lerp(state.points[seg.i + 1], u);
        }
      }
      return target.copy(state.points[state.points.length - 1]);
    },
    getTangentAt(t, target = new THREE.Vector3()) {
      if (state.points.length < 2) return target.set(1, 0, 0);
      const d = THREE.MathUtils.clamp(t, 0, 1) * state.totalLength;
      for (let s = 0; s < state.segments.length; s += 1) {
        const seg = state.segments[s];
        if (d <= seg.dist0 + seg.length + 1e-6) {
          return target
            .copy(state.points[seg.i + 1])
            .sub(state.points[seg.i])
            .normalize();
        }
      }
      const n = state.points.length;
      return target.copy(state.points[n - 1]).sub(state.points[n - 2]).normalize();
    },
  };
}

const segmentScratch = {
  dir: new THREE.Vector3(),
  mid: new THREE.Vector3(),
  quat: new THREE.Quaternion(),
  up: new THREE.Vector3(0, 1, 0),
  mat: new THREE.Matrix4(),
};

function appendCylinderBetween(geometries, THREE, a, b, radius, radialSegments) {
  segmentScratch.dir.subVectors(b, a);
  const len = segmentScratch.dir.length();
  if (len < 1e-5) return;
  const cyl = new THREE.CylinderGeometry(radius, radius, len, radialSegments, 1, false);
  segmentScratch.mid.copy(a).add(b).multiplyScalar(0.5);
  segmentScratch.quat.setFromUnitVectors(segmentScratch.up, segmentScratch.dir.normalize());
  segmentScratch.mat.compose(
    segmentScratch.mid,
    segmentScratch.quat,
    new THREE.Vector3(1, 1, 1)
  );
  cyl.applyMatrix4(segmentScratch.mat);
  geometries.push(cyl);
}

function appendJointSphere(geometries, THREE, point, radius) {
  const sphere = new THREE.SphereGeometry(radius, 8, 8);
  sphere.translate(point.x, point.y, point.z);
  geometries.push(sphere);
}

function createSegmentedDuctGeometry(THREE, points, radius, radialSegments = 12) {
  const pts = dedupePolylinePoints(points);
  if (pts.length < 2) return new THREE.BufferGeometry();

  const parts = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    appendCylinderBetween(parts, THREE, pts[i], pts[i + 1], radius, radialSegments);
  }
  for (let i = 1; i < pts.length - 1; i += 1) {
    appendJointSphere(parts, THREE, pts[i], radius * 1.02);
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return merged || new THREE.BufferGeometry();
}

function flowShellMaterial(THREE, borderColor, opacity = 0) {
  return new THREE.MeshStandardMaterial({
    color: borderColor,
    transparent: true,
    opacity,
    roughness: 0.36,
    metalness: 0.07,
    emissive: borderColor,
    emissiveIntensity: 0.05,
    depthTest: true,
    depthWrite: false,
  });
}

function flowCoreMaterial(THREE, tintColor, opacity = 0) {
  const fill = flowTintWhite(tintColor, 0.22);
  return new THREE.MeshStandardMaterial({
    color: fill,
    transparent: true,
    opacity,
    roughness: 0.45,
    metalness: 0,
    emissive: tintColor,
    emissiveIntensity: 0.08,
    depthTest: true,
    depthWrite: false,
  });
}

function flowOverlayMaterial(THREE, MatCtor, options) {
  const mat = new MatCtor(options);
  mat.transparent = true;
  mat.depthTest = false;
  mat.depthWrite = false;
  return mat;
}

function rebuildFlowMeshes(THREE, flow) {
  const pts = flow.path.points;
  const radius = flow.pipeRadius ?? 0.04;
  const radial = flow.radialSegments ?? 12;

  flow.pipe.geometry.dispose();
  flow.pipe.geometry = createSegmentedDuctGeometry(THREE, pts, radius, radial);

  if (flow.pipeLiner) {
    flow.pipeLiner.geometry.dispose();
    flow.pipeLiner.geometry = createSegmentedDuctGeometry(
      THREE,
      pts,
      radius * FLOW_CORE_INNER,
      radial
    );
  }
}

export function createFlowSystem(THREE, rooftopRetrofitGroup, options = {}) {
  const particleCount = options.particleCount ?? 5;
  const anchorsLocal = rooftopRetrofitGroup.userData.flowAnchorsLocal;
  const flows = [];

  PRIMARY_FLOW_IDS.forEach((id) => {
    const palette = FLOW_PALETTE[id];
    const style = FLOW_STYLE[id];
    if (!palette || !style || !anchorsLocal?.[id]) return;

    const color = palette.three;
    const arrowColor = palette.arrowThree ?? palette.three;
    const worldPts = localToWorldPoints(rooftopRetrofitGroup, anchorsLocal[id]);
    const path = createFlowPolylinePath(worldPts);

    const pipeRadius = style.pipeRadius ?? 0.04;
    const radialSegments = style.radial ?? 12;
    const pipeGeo = createSegmentedDuctGeometry(THREE, path.points, pipeRadius, radialSegments);
    const pipe = new THREE.Mesh(pipeGeo, flowShellMaterial(THREE, color, 0));
    pipe.renderOrder = 18;
    pipe.name = `flow-pipe-${id}`;

    const linerGeo = createSegmentedDuctGeometry(
      THREE,
      path.points,
      pipeRadius * FLOW_CORE_INNER,
      radialSegments
    );
    const pipeLiner = new THREE.Mesh(linerGeo, flowCoreMaterial(THREE, color, 0));
    pipeLiner.renderOrder = 19;
    pipeLiner.name = `flow-pipe-core-${id}`;

    const capGeo = geo(THREE, 'flow_port', () => new THREE.SphereGeometry(1, 10, 10));
    const startCap = new THREE.Mesh(capGeo, flowShellMaterial(THREE, color, 0));
    const endCap = new THREE.Mesh(capGeo, flowShellMaterial(THREE, color, 0));
    startCap.renderOrder = 21;
    endCap.renderOrder = 21;

    const markerGeo = geo(THREE, 'flow_arrow', () => new THREE.ConeGeometry(0.012, 0.032, 5));

    const particles = [];
    for (let i = 0; i < particleCount; i += 1) {
      const p = new THREE.Mesh(
        markerGeo,
        flowOverlayMaterial(THREE, THREE.MeshBasicMaterial, {
          color: arrowColor,
          opacity: 0,
        })
      );
      p.renderOrder = 25;
      p.userData.t = i / particleCount;
      p.userData.speed = style.speed * (0.94 + (i % 3) * 0.03);
      particles.push(p);
    }

    flows.push({
      id,
      path,
      curve: path,
      pipe,
      pipeLiner,
      line: null,
      particles,
      startCap,
      endCap,
      color,
      kind: 'duct',
      pipeRadius,
      radialSegments,
    });
  });

  return flows;
}

export function updateFlowPaths(flows, rooftopRetrofitGroup, THREE) {
  const anchorsLocal = rooftopRetrofitGroup.userData.flowAnchorsLocal;
  flows.forEach((flow) => {
    const localPts = anchorsLocal?.[flow.id];
    if (!localPts) return;
    flow.path.points = localToWorldPoints(rooftopRetrofitGroup, localPts);
    flow.path.updateArcLengths();
    rebuildFlowMeshes(THREE, flow);
  });
}

const flowScratch = { pt: new THREE.Vector3(), ahead: new THREE.Vector3(), look: new THREE.Vector3() };

export function setFlowVisibility(flows, opacity, activeIds) {
  flows.forEach((flow) => {
    const on = activeIds.includes(flow.id);
    const reveal = on ? Math.max(0.55, opacity) : 0;

    flow.pipe.material.opacity = reveal * 0.9;
    if (flow.pipeLiner) {
      flow.pipeLiner.material.opacity = reveal * 0.94;
    }
    const capScale = (flow.pipeRadius ?? 0.036) * 1.35;
    if (flow.startCap) {
      flow.startCap.material.opacity = reveal * 0.95;
      flow.startCap.scale.setScalar(capScale);
      flow.startCap.visible = reveal > 0.08;
      if (flow.startCap.visible) {
        flow.path.getPointAt(0, flowScratch.pt);
        flow.startCap.position.copy(flowScratch.pt);
      }
    }
    if (flow.endCap) {
      flow.endCap.material.opacity = reveal * 0.95;
      flow.endCap.scale.setScalar(capScale * 1.08);
      flow.endCap.visible = reveal > 0.08;
      if (flow.endCap.visible) {
        flow.path.getPointAt(1, flowScratch.pt);
        flow.endCap.position.copy(flowScratch.pt);
      }
    }
    flow.particles.forEach((p) => {
      p.material.opacity = reveal > 0.12 ? Math.min(0.55, reveal * 0.5) : 0;
      p.visible = reveal > 0.12;
    });
  });
}

export function tickFlows(flows, dt, animate, reducedMotion) {
  if (!animate) return;
  const speedMul = reducedMotion ? 0.2 : 1;
  flows.forEach((flow) => {
    if (flow.pipe.material.opacity <= 0.01) return;

    flow.particles.forEach((p) => {
      if (!p.visible) return;
      if (!reducedMotion) {
        p.userData.t = (p.userData.t + p.userData.speed * speedMul * dt) % 1;
      }
      const t = p.userData.t;
      flow.path.getPointAt(t, flowScratch.pt);
      flow.path.getTangentAt(t, flowScratch.ahead);
      p.position.copy(flowScratch.pt);
      flowScratch.look.copy(flowScratch.pt).add(flowScratch.ahead);
      p.lookAt(flowScratch.look);
      p.rotateX(Math.PI / 2);
    });

    if (flow.startCap?.visible) {
      flow.path.getPointAt(0, flowScratch.pt);
      flow.startCap.position.copy(flowScratch.pt);
    }
    if (flow.endCap?.visible) {
      flow.path.getPointAt(1, flowScratch.pt);
      flow.endCap.position.copy(flowScratch.pt);
    }
  });
}

export function tickFans(spinMeshes, dt, animate) {
  if (!animate) return;
  spinMeshes.forEach((fan) => {
    const axis = fan.userData.spinAxis || 'y';
    const speed = fan.userData.spinSpeed || 5;
    fan.rotation[axis] += dt * speed;
  });
}

export function disposeRooftopResources(flows, rooftopRetrofitGroup) {
  if (flows) {
    flows.forEach((flow) => {
      flow.pipe?.geometry.dispose();
      flow.pipe?.material.dispose();
      flow.pipeLiner?.material.dispose();
      flow.startCap?.material.dispose();
      flow.endCap?.material.dispose();
      flow.line?.geometry?.dispose();
      flow.line?.material?.dispose();
      flow.particles.forEach((p) => {
        p.material.dispose();
      });
    });
  }
  if (rooftopRetrofitGroup) {
    rooftopRetrofitGroup.traverse((obj) => {
      if (obj.isMesh && obj.material && obj.userData.baseY !== undefined) {
        obj.material.dispose();
      }
    });
  }
  sharedMaterials = null;
}

export function getFlowLabelDefinitions() {
  const meta = {
    freshAir: { t: 0.08, offsetX: -52, offsetY: -28 },
    exhaustAir: { t: 0.92, offsetX: 36, offsetY: -18 },
    recoveredEnergy: { t: 0.5, offsetX: -36, offsetY: -12 },
    supplyAir: { t: 0.72, offsetX: 28, offsetY: 4 },
    warmWater: { t: 0.38, offsetX: 0, offsetY: 22 },
  };
  return PRIMARY_FLOW_IDS.map((id) => {
    const palette = FLOW_PALETTE[id];
    const m = meta[id] || { t: 0.4, offsetX: 0, offsetY: 0 };
    return {
      id,
      label: palette.label,
      color: palette.hex,
      tagBg: palette.hex,
      tagFg: palette.tagFg,
      ...m,
    };
  });
}

export function getLabelDefinitions() {
  return [
    {
      id: 'erv',
      title: 'Energy Recovery Ventilator',
      body: 'Recovers useful energy from exhaust air while keeping outdoor and exhaust air streams separate.',
      anchor: 'erv',
      order: 1,
      defaultPos: { nx: 0.01, ny: 0.14 },
    },
    {
      id: 'exhaust',
      title: 'Coordinated Exhaust',
      body: 'Removes stale air while helping maintain balanced building pressure.',
      anchor: 'ductwork',
      order: 2,
      defaultPos: { nx: 0.74, ny: 0.38 },
    },
    {
      id: 'heatPumpBank',
      title: 'Air-Source Heat Pumps',
      body: 'Electrify heating and cooling and use recovered energy before staged support is added.',
      anchor: 'heatPumpBank',
      order: 3,
      defaultPos: { nx: 0.17, ny: 0.03 },
    },
    {
      id: 'ahu',
      title: 'Air-Handling Unit',
      body: 'Conditions and distributes ventilation air through coordinated controls and ductwork.',
      anchor: 'ahu',
      order: 4,
      defaultPos: { nx: 0.33, ny: 0.02 },
    },
    {
      id: 'hydronics',
      title: 'Hydronic Distribution',
      body: 'Moves warm and chilled water through insulated piping, pumps, and valves.',
      anchor: 'hydronics',
      order: 5,
      defaultPos: { nx: 0.3, ny: 0.76 },
    },
    {
      id: 'coolingTower',
      title: 'Cooling Tower — When Required',
      body: 'Rejects excess heat when the condenser-water strategy requires it.',
      anchor: 'coolingTower',
      order: 6,
      defaultPos: { nx: 0.56, ny: 0.06 },
    },
  ];
}
