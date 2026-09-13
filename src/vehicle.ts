import * as THREE from 'three';
import { box, cylinder, labelTexture, rod, setRod } from './geometry.ts';
import type { CarPose } from './controller.ts';

/** Wheel centres sit at z = ±WHEEL_Z; front is negative z. */
export const WHEEL_Z = 1.5;

/** Road height under each wheel: front-left, front-right, rear-left, rear-right. */
export type WheelGround = [number, number, number, number];
import { DEFAULT_DESIGN, PAINTS, WHEELS, designMeasurements, type CarDesign, type WheelId } from './customization.ts';

class CoilCurve extends THREE.Curve<THREE.Vector3> {
  constructor() { super(); }

  getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const angle = t * Math.PI * 12;
    return target.set(Math.cos(angle) * 0.105, t, Math.sin(angle) * 0.105);
  }
}

export function createVehicle(makeLabel = labelTexture) {
  const root = new THREE.Group();
  root.name = 'little-explorer';
  root.position.y = 0.018;
  const body = new THREE.Group();
  body.name = 'sprung-body';
  root.add(body);
  const runningGear = new THREE.Group();
  runningGear.name = 'running-gear';
  root.add(runningGear);

  const paint = new THREE.MeshPhysicalMaterial({ color: '#cd9d46', roughness: 0.46, metalness: 0.06, clearcoat: 0.4, clearcoatRoughness: 0.35 });
  const cream = new THREE.MeshStandardMaterial({ color: '#f1e8d3', roughness: 0.48 });
  const dark = new THREE.MeshStandardMaterial({ color: '#34413d', roughness: 0.58 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#27302e', roughness: 0.93 });
  const rubberEdge = new THREE.MeshStandardMaterial({ color: '#36403c', roughness: 0.85 });
  const silver = new THREE.MeshStandardMaterial({ color: '#b0bcb7', roughness: 0.33, metalness: 0.72 });
  const seat = new THREE.MeshStandardMaterial({ color: '#786551', roughness: 0.92 });
  const fabric = new THREE.MeshStandardMaterial({ color: '#a38b69', roughness: 0.95 });
  const coilPaint = new THREE.MeshStandardMaterial({ color: '#f5bf48', roughness: 0.37, metalness: 0.24 });
  const red = new THREE.MeshStandardMaterial({ color: '#d65037', roughness: 0.48 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#3d4b4d', roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  const headlamp = new THREE.MeshStandardMaterial({ color: '#f1e4bd', emissive: '#ffdc7f', emissiveIntensity: 0, roughness: 0.23, metalness: 0.15 });
  const taillamp = new THREE.MeshStandardMaterial({ color: '#762c26', emissive: '#ff1510', emissiveIntensity: 0, roughness: 0.3 });
  const amber = new THREE.MeshStandardMaterial({ color: '#edb554', roughness: 0.4 });

  // Layout (world units, wheel radius 0.60): front is negative z. A boxy body with short overhangs.
  const W = 1.18;            // half body width
  const FRONT = -2.50;       // front bumper face
  const REAR = 2.45;         // rear body face (spare tyre hangs beyond)
  const BELT = 2.02;         // beltline: paint below, glass above
  const ROOF = 2.72;         // roof panel centre

  // Chassis floor and rails belong to the sprung body; wheels stay on the ground.
  box(body, [2.20, 0.18, 4.60], [0, 1.13, 0], dark);
  for (const side of [-1, 1]) box(body, [0.13, 0.17, 4.30], [side * 0.85, 1.00, 0], dark);
  box(body, [2.16, 0.06, 2.30], [0, 1.48, 0.85], dark, 0.02);

  // Engine bay: open between the front wings, closed by the hood.
  box(body, [2.10, 0.09, 1.50], [0, 1.40, -1.62], dark);
  for (const side of [-1, 1]) {
    box(body, [0.22, 0.72, 1.58], [side * 1.07, 1.66, -1.60], paint, 0.05);
    box(body, [0.14, 0.08, 1.58], [side * 1.11, 2.00, -1.60], paint);
  }
  box(body, [2.30, 0.36, 0.18], [0, 1.84, -0.84], paint, 0.05);
  box(body, [1.00, 0.26, 0.72], [0, 1.60, -1.62], silver);
  box(body, [0.62, 0.07, 0.50], [0, 1.76, -1.62], dark);
  for (let i = 0; i < 5; i++) box(body, [0.065, 0.08, 0.50], [-0.24 + i * 0.12, 1.79, -1.62], silver, 0.014);
  box(body, [0.33, 0.20, 0.32], [0.70, 1.58, -1.22], dark);
  cylinder(body, 0.08, 0.04, [0.70, 1.70, -1.22], red);
  rod(body, new THREE.Vector3(-0.55, 1.58, -1.32), new THREE.Vector3(-0.65, 1.62, -2.05), 0.045, dark);

  // Front face: a full-width black light bar with twin square lamps each side, paint bumper, black lower guard.
  box(body, [2.34, 0.32, 0.12], [0, 1.82, FRONT + 0.05], dark, 0.02);
  box(body, [0.90, 0.035, 0.03], [0, 1.82, FRONT - 0.005], silver, 0.01);
  for (let i = 0; i < 4; i++) box(body, [0.05, 0.05, 0.03], [-0.27 + i * 0.18, 1.82, FRONT - 0.01], cream, 0.01);
  const lightGroup = new THREE.Group();
  body.add(lightGroup);
  for (const side of [-1, 1]) {
    for (const y of [1.89, 1.75]) box(body, [0.22, 0.10, 0.03], [side * 0.86, y, FRONT - 0.015], headlamp, 0.015);
    for (const x of [0.68, 1.05]) box(body, [0.045, 0.26, 0.025], [side * x, 1.82, FRONT - 0.012], cream, 0.01);
    const light = new THREE.SpotLight('#ffe1a0', 14, 8, 0.48, 0.85, 1.5);
    light.position.set(side * 0.86, 1.82, FRONT - 0.1);
    light.target.position.set(side * 0.95, 0, FRONT - 3.2);
    lightGroup.add(light, light.target);
  }
  lightGroup.visible = false;
  box(body, [2.36, 0.36, 0.16], [0, 1.48, FRONT + 0.06], paint, 0.04);
  box(body, [2.44, 0.30, 0.36], [0, 1.15, FRONT + 0.12], dark, 0.06);
  box(body, [1.10, 0.08, 0.34], [0, 0.99, FRONT + 0.12], silver, 0.02);
  for (const side of [-1, 1]) {
    box(body, [0.16, 0.11, 0.03], [side * 0.98, 1.15, FRONT - 0.07], amber, 0.02);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 10, 20), red);
    hook.position.set(side * 0.55, 1.03, FRONT - 0.16);
    body.add(hook);
  }

  // Hood: flat with a central power bulge.
  const hoodPivot = new THREE.Group();
  hoodPivot.name = 'hood-hinge';
  hoodPivot.position.set(0, 2.03, -0.86);
  body.add(hoodPivot);
  box(hoodPivot, [2.16, 0.10, 1.62], [0, 0, -0.81], paint, 0.045);
  box(hoodPivot, [1.10, 0.04, 1.40], [0, 0.055, -0.82], paint, 0.02);
  box(hoodPivot, [1.4, 0.045, 0.9], [0, -0.075, -0.75], dark);

  // Cabin: black rocker, black pillars, dark glass in one band, paint roof with twin rails.
  box(body, [2.40, 0.24, 3.30], [0, 1.38, 0.82], dark, 0.03);
  box(body, [2.30, 0.10, 0.22], [0, 2.06, -0.80], paint);
  const windshield = box(body, [2.08, 0.66, 0.024], [0, 2.40, -0.70], glass, 0.008);
  windshield.rotation.x = 0.28;
  for (const side of [-1, 1]) {
    rod(body, new THREE.Vector3(side * 1.08, 2.06, -0.82), new THREE.Vector3(side * 1.06, 2.72, -0.60), 0.07, dark);
    box(body, [0.12, 0.72, 0.09], [side * 1.11, 2.36, 0.48], dark);
    box(body, [0.12, 0.72, 0.09], [side * 1.11, 2.36, 1.66], dark);
    box(body, [0.14, 0.72, 0.30], [side * 1.11, 2.36, REAR - 0.15], paint, 0.03);
    box(body, [0.03, 0.60, 0.62], [side * 1.13, 2.35, 2.00], glass, 0.009);
    box(body, [0.10, 0.06, 0.66], [side * 1.12, 2.67, 2.00], dark, 0.012);
    box(body, [0.10, 0.06, 0.66], [side * 1.12, 2.045, 2.00], dark, 0.012);
    // Rear quarter below the beltline and the fixed rear side.
    box(body, [0.16, 0.52, 0.84], [side * 1.10, 1.76, REAR - 0.42], paint, 0.035);
    // Front wing vent behind the arch.
    box(body, [0.03, 0.10, 0.20], [side * (W + 0.005), 1.82, -0.84], dark, 0.01);
  }
  box(body, [2.30, 0.14, 3.26], [0, ROOF, 0.82], paint, 0.05);
  box(body, [2.22, 0.045, 3.20], [0, ROOF - 0.09, 0.82], dark, 0.02);
  box(body, [2.24, 0.10, 0.16], [0, ROOF - 0.08, -0.70], dark, 0.02);
  for (const side of [-1, 1]) {
    box(body, [0.10, 0.09, 2.30], [side * 0.74, ROOF + 0.12, 1.05], dark, 0.02);
    for (const z of [-0.05, 1.0, 2.15]) box(body, [0.08, 0.06, 0.12], [side * 0.74, ROOF + 0.09, z], dark, 0.012);
  }
  box(body, [0.30, 0.09, 0.26], [0, ROOF + 0.10, -0.26], dark, 0.03);

  const cargo = new THREE.Group();
  cargo.name = 'roof-cargo';
  const luggagePaint = new THREE.MeshStandardMaterial({ color: '#a4ad8b', roughness: 0.68 });
  box(cargo, [1.43, 0.29, 1.72], [0, 3.02, 1.0], luggagePaint, 0.095);
  box(cargo, [1.44, 0.025, 1.73], [0, 3.01, 1.0], dark, 0.011);
  for (const x of [-0.46, 0.46]) {
    box(cargo, [0.075, 0.025, 1.64], [x, 3.167, 1.0], cream, 0.011);
    for (const z of [0.15, 1.85]) box(cargo, [0.075, 0.23, 0.024], [x, 3.035, z], cream, 0.009);
  }
  box(cargo, [0.27, 0.055, 0.045], [0, 3.02, 0.11], dark, 0.02);

  const tent = new THREE.Group();
  tent.name = 'roof-tent';
  box(tent, [1.67, 0.095, 1.96], [0, 2.90, 1.0], dark, 0.025);
  const canvas = new THREE.MeshStandardMaterial({ color: '#dbbd7b', roughness: 0.95, side: THREE.DoubleSide });
  const tentShape = new THREE.Shape().moveTo(-0.77, 0).lineTo(0, 0.58).lineTo(0.77, 0).closePath();
  const canopy = new THREE.Mesh(new THREE.ExtrudeGeometry(tentShape, { depth: 1.79, bevelEnabled: false, steps: 1 }), canvas);
  canopy.position.set(0, 2.95, 0.10);
  canopy.castShadow = true;
  canopy.receiveShadow = true;
  tent.add(canopy);
  const openingShape = new THREE.Shape().moveTo(-0.43, 0).lineTo(0, 0.44).lineTo(0.43, 0).closePath();
  const opening = new THREE.Mesh(new THREE.ShapeGeometry(openingShape), new THREE.MeshStandardMaterial({ color: '#526557', roughness: 1, side: THREE.DoubleSide }));
  opening.position.set(0, 2.954, 0.095);
  tent.add(opening);
  for (const z of [0.092, 1.895]) {
    for (const side of [-1, 1]) rod(tent, new THREE.Vector3(side * 0.77, 2.95, z), new THREE.Vector3(0, 3.535, z), 0.022, cream);
  }
  rod(tent, new THREE.Vector3(0, 3.535, 0.085), new THREE.Vector3(0, 3.535, 1.905), 0.025, dark);
  rod(tent, new THREE.Vector3(0, 2.96, 0.085), new THREE.Vector3(0, 3.37, 0.085), 0.012, cream);
  cylinder(tent, 0.08, 1.08, [0, 2.98, 1.95], luggagePaint).rotation.z = Math.PI / 2;
  cargo.visible = false;
  tent.visible = false;
  body.add(cargo, tent);

  // Dashboard, seats, a little steering wheel and a rear bench.
  box(body, [2.10, 0.26, 0.34], [0, 1.96, -0.62], dark, 0.045);
  for (const side of [-1, 1]) {
    box(body, [0.54, 0.18, 0.59], [side * 0.52, 1.64, 0.02], seat, 0.07);
    const back = box(body, [0.53, 0.67, 0.17], [side * 0.52, 1.98, 0.32], seat, 0.06);
    back.rotation.x = -0.07;
    box(body, [0.39, 0.46, 0.028], [side * 0.52, 1.99, 0.218], fabric);
    box(body, [0.35, 0.20, 0.18], [side * 0.52, 2.37, 0.34], seat, 0.07);
  }
  box(body, [1.90, 0.18, 0.55], [0, 1.64, 1.10], seat, 0.07);
  box(body, [1.90, 0.62, 0.16], [0, 1.98, 1.40], seat, 0.06);
  rod(body, new THREE.Vector3(-0.53, 1.93, -0.57), new THREE.Vector3(-0.53, 2.05, -0.29), 0.035, silver);
  const steering = new THREE.Group();
  steering.position.set(-0.53, 2.05, -0.28);
  steering.rotation.x = -0.32;
  steering.add(new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.026, 10, 32), dark));
  box(steering, [0.32, 0.035, 0.025], [0, 0, 0], dark, 0.009);
  box(steering, [0.035, 0.19, 0.025], [0, -0.07, 0], dark, 0.009);
  body.add(steering);
  box(body, [0.18, 0.06, 0.22], [0, 1.59, -0.08], dark);
  rod(body, new THREE.Vector3(0, 1.62, -0.10), new THREE.Vector3(0, 1.82, -0.12), 0.025, silver);

  // Four doors: front and rear on each side, hinged at their leading edge and opening together.
  const doorPivots: THREE.Group[] = [];
  const doorSides: number[] = [];
  const doorSpecs: Array<{ name: string; z: number; length: number; mirror: boolean }> = [
    { name: 'door-hinge', z: -0.74, length: 1.18, mirror: true },
    { name: 'rear-door-hinge', z: 0.52, length: 1.10, mirror: false },
  ];
  for (const side of [-1, 1]) {
    for (const spec of doorSpecs) {
      const pivot = new THREE.Group();
      pivot.name = (side < 0 ? 'left-' : 'right-') + spec.name;
      pivot.position.set(side * (W - 0.03), BELT - 0.02, spec.z);
      body.add(pivot);
      const mid = spec.length / 2;
      box(pivot, [0.105, 0.50, spec.length], [0, -0.26, mid], paint, 0.03);
      box(pivot, [0.025, 0.58, spec.length - 0.12], [0, 0.34, mid], glass, 0.009);
      box(pivot, [0.095, 0.06, spec.length], [0, 0.04, mid], dark, 0.02);
      box(pivot, [0.09, 0.06, spec.length], [0, 0.66, mid], dark, 0.016);
      for (const z of [0.04, spec.length - 0.04]) box(pivot, [0.09, 0.66, 0.075], [0, 0.35, z], dark, 0.016);
      box(pivot, [0.03, 0.055, 0.30], [side * 0.06, -0.10, spec.length - 0.36], silver, 0.012);
      box(pivot, [0.02, 0.085, 0.36], [side * 0.045, -0.10, spec.length - 0.36], dark, 0.012);
      box(pivot, [0.017, 0.36, spec.length - 0.3], [-side * 0.063, -0.22, mid], seat, 0.008);
      if (spec.mirror) {
        box(pivot, [0.28, 0.20, 0.22], [side * 0.24, 0.32, 0.24], dark, 0.03);
        box(pivot, [0.12, 0.07, 0.10], [side * 0.10, 0.26, 0.22], dark, 0.01);
      }
      doorPivots.push(pivot);
      doorSides.push(side);
    }
  }

  // Rear: fixed quarters carry the vertical tail lamps; the narrow tailgate swings sideways carrying the spare.
  box(body, [1.94, 0.055, 1.10], [0, 1.49, 1.85], seat);
  box(body, [0.65, 0.28, 0.48], [-0.42, 1.66, 1.95], cream, 0.035);
  for (const x of [-0.65, -0.41, -0.18]) box(body, [0.045, 0.02, 0.48], [x, 1.809, 1.95], fabric, 0.008);
  box(body, [0.35, 0.24, 0.38], [0.45, 1.64, 2.05], dark);
  const hingeX = -0.96;
  const doorHalf = 0.94;
  const trunkPivot = new THREE.Group();
  trunkPivot.name = 'trunk-hinge';
  trunkPivot.position.set(hingeX, 2.67, REAR);
  body.add(trunkPivot);
  box(trunkPivot, [1.86, 0.52, 0.11], [doorHalf, -0.91, 0], paint, 0.035);
  box(trunkPivot, [1.70, 0.58, 0.027], [doorHalf, -0.34, 0.014], glass, 0.009);
  for (const x of [0.06, 2 * doorHalf - 0.06]) box(trunkPivot, [0.09, 0.66, 0.08], [x, -0.33, 0], dark);
  box(trunkPivot, [1.86, 0.065, 0.09], [doorHalf, -0.03, 0], dark);
  box(trunkPivot, [1.86, 0.06, 0.10], [doorHalf, -0.64, 0], dark);
  box(trunkPivot, [0.06, 0.30, 0.07], [2 * doorHalf - 0.36, -0.86, 0.08], dark, 0.02);
  box(trunkPivot, [0.03, 0.22, 0.04], [2 * doorHalf - 0.36, -0.86, 0.115], silver, 0.01);
  for (const y of [-0.15, -0.85]) box(body, [0.07, 0.17, 0.09], [hingeX - 0.06, 2.67 + y, REAR + 0.025], dark, 0.02);
  for (const side of [-1, 1]) {
    box(body, [0.20, 0.50, 0.07], [side * 1.075, 1.76, REAR + 0.01], dark, 0.015);
    box(body, [0.15, 0.17, 0.025], [side * 1.075, 1.86, REAR + 0.045], taillamp, 0.015);
    box(body, [0.15, 0.11, 0.025], [side * 1.075, 1.645, REAR + 0.045], taillamp, 0.015);
  }
  box(body, [2.36, 0.24, 0.16], [0, 1.38, REAR - 0.05], paint, 0.03);
  box(body, [2.44, 0.28, 0.34], [0, 1.15, REAR - 0.06], dark, 0.06);
  for (const side of [-1, 1]) {
    box(body, [0.30, 0.22, 0.05], [side * 1.05, 1.15, REAR + 0.12], silver, 0.02);
    box(body, [0.14, 0.06, 0.02], [side * 1.05, 1.15, REAR + 0.15], taillamp, 0.01);
  }

  // Side steps hang from the rocker on solid brackets when the chassis is raised, so the driver can still climb in.
  const sillBottom = 1.26;
  const sideSteps: Array<{ group: THREE.Group; brackets: THREE.Mesh[] }> = [];
  for (const side of [-1, 1]) {
    const group = new THREE.Group();
    group.name = side < 0 ? 'left-side-step' : 'right-side-step';
    box(group, [0.30, 0.05, 1.30], [side * 1.30, 0, -0.09], dark, 0.02);
    box(group, [0.05, 0.05, 1.30], [side * 1.465, 0.012, -0.09], rubberEdge, 0.02);
    for (const z of [-0.54, -0.24, 0.06, 0.36]) box(group, [0.20, 0.014, 0.05], [side * 1.30, 0.03, z], silver, 0.005);
    const brackets = [-0.45, 0.27].map((z) => box(group, [0.11, 1, 0.16], [side * 1.22, 0.5, z], dark, 0.015));
    group.visible = false;
    body.add(group);
    sideSteps.push({ group, brackets });
  }

  function wheel(side: number, kind: WheelId): THREE.Group {
    const group = new THREE.Group();
    group.name = 'wheel-style-' + kind;
    const rimMaterial = kind === 'crawler' ? coilPaint : silver;
    cylinder(group, kind === 'road' ? 0.592 : 0.576, 0.39, [0, 0, 0], rubber, 48).rotation.z = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.07, 12, 48), rubberEdge);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = side * 0.18;
    group.add(ring);
    cylinder(group, 0.36, 0.025, [side * 0.213, 0, 0], rimMaterial, 40).rotation.z = Math.PI / 2;
    cylinder(group, 0.33, 0.035, [side * 0.23, 0, 0], dark, 40).rotation.z = Math.PI / 2;
    cylinder(group, 0.11, 0.06, [side * 0.258, 0, 0], dark).rotation.z = Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      const spoke = box(group, [0.03, 0.22, 0.11], [side * 0.255, Math.cos(angle) * 0.195, Math.sin(angle) * 0.195], rimMaterial, 0.012);
      spoke.rotation.x = angle + 0.35;
      cylinder(group, 0.02, 0.064, [side * 0.27, Math.cos(angle) * 0.07, Math.sin(angle) * 0.07], silver, 10).rotation.z = Math.PI / 2;
    }
    const count = kind === 'road' ? 48 : kind === 'crawler' ? 20 : 32;
    const treadGeometry = new THREE.BoxGeometry(0.405, kind === 'road' ? 0.012 : kind === 'crawler' ? 0.065 : 0.043, kind === 'crawler' ? 0.15 : 0.075);
    const treads = new THREE.InstancedMesh(treadGeometry, rubber, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count;
      const radius = kind === 'road' ? 0.591 : kind === 'crawler' ? 0.565 : 0.576;
      dummy.position.set(0, Math.cos(angle) * radius, Math.sin(angle) * radius);
      dummy.rotation.set(angle, 0, (i % 2 ? 1 : -1) * (kind === 'road' ? 0 : 0.12));
      dummy.updateMatrix();
      treads.setMatrixAt(i, dummy.matrix);
    }
    treads.castShadow = true;
    treads.receiveShadow = true;
    group.add(treads);
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; }
    });
    return group;
  }

  const wheels: THREE.Group[] = [];
  const wheelStyles: Array<Record<WheelId, THREE.Group>> = [];
  const arches: Array<{ mesh: THREE.Group; bridge: THREE.Mesh; side: number }> = [];
  const axles: THREE.Mesh[] = [];
  function wheelSet(side: number): THREE.Group {
    const mount = new THREE.Group();
    const variants = Object.fromEntries(WHEELS.map(({ id }) => [id, wheel(side, id)])) as Record<WheelId, THREE.Group>;
    for (const [id, variant] of Object.entries(variants)) {
      variant.visible = id === DEFAULT_DESIGN.wheels;
      mount.add(variant);
    }
    wheelStyles.push(variants);
    return mount;
  }
  // Wheel and spring order: front-left, front-right, rear-left, rear-right. Front is negative z.
  const springs: Array<{ mesh: THREE.Mesh; cap: THREE.Mesh; damper: THREE.Mesh; arm: THREE.Mesh; seat: THREE.Mesh; bottom: THREE.Vector3; top: THREE.Vector3; local: THREE.Vector3 }> = [];
  const coilGeometry = new THREE.TubeGeometry(new CoilCurve(), 144, 0.023, 7, false);
  for (const z of [-WHEEL_Z, WHEEL_Z]) {
    axles.push(rod(runningGear, new THREE.Vector3(-1.12, 0.60, z), new THREE.Vector3(1.12, 0.60, z), 0.095, dark));
    for (const side of [-1, 1]) {
      const tire = wheelSet(side);
      tire.position.set(side * 1.12, 0.60, z);
      tire.name = 'grounded-wheel-' + side + '-' + z;
      runningGear.add(tire);
      wheels.push(tire);
      // Square black arch: a flat top and two short legs, scaled with the tyre.
      const arch = new THREE.Group();
      arch.position.set(side * (W + 0.10), 0.60, z);
      // An eyebrow over the wheel: flat top at fender height, short legs ending at the rocker.
      box(arch, [0.26, 0.14, 1.76], [0, 1.00, 0], dark, 0.03);
      for (const leg of [-0.82, 0.82]) box(arch, [0.26, 0.42, 0.14], [0, 0.74, leg], dark, 0.03);
      body.add(arch);
      const bridge = box(body, [1, 0.11, 1.60], [side * 1.04, 1.38, z], dark, 0.025);
      bridge.scale.x = 0.19;
      arches.push({ mesh: arch, bridge, side });
      // Exposed trailing-arm springs are visible between the wheels, below the door sill.
      const springZ = Math.sign(z) * 0.62;
      const bottom = new THREE.Vector3(side * 0.97, 0.64, springZ);
      const top = new THREE.Vector3(side * 0.97, 1.22, springZ);
      const arm = rod(runningGear, new THREE.Vector3(side * 0.97, 0.64, z), bottom, 0.055, dark);
      box(body, [0.30, 0.07, 0.24], [side * 0.86, 1.24, springZ], dark);
      const coil = new THREE.Mesh(coilGeometry, coilPaint);
      coil.position.copy(bottom);
      coil.scale.y = top.y - bottom.y;
      coil.castShadow = true;
      root.add(coil);
      const seat = cylinder(runningGear, 0.14, 0.045, [bottom.x, bottom.y, bottom.z], dark);
      const cap = cylinder(root, 0.14, 0.045, [top.x, top.y, top.z], silver);
      const damper = rod(root, bottom, top, 0.033, silver);
      springs.push({ mesh: coil, cap, damper, arm, seat, bottom, top, local: new THREE.Vector3(side * 0.97, 1.22, springZ) });
    }
  }
  const spare = wheelSet(1);
  spare.scale.setScalar(0.84);
  spare.rotation.y = -Math.PI / 2;
  spare.position.set(doorHalf - 0.30, -0.74, 0.30);
  trunkPivot.add(spare);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.20), new THREE.MeshBasicMaterial({ map: makeLabel('LITTLE', '#eee7d7', '#34413d', 384, 112) }));
  plate.position.set(0, 1.15, REAR + 0.115);
  body.add(plate);
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.material === glass) object.castShadow = false;
  });

  let lampsOn = false;
  let design: CarDesign = { ...DEFAULT_DESIGN };
  let rideLift = 0;
  let radiusDelta = 0;
  let wheelRadius = 0.60;
  let lastGround: WheelGround = [0, 0, 0, 0];
  let lastPose: CarPose = { doors: 0, hood: 0, trunk: 0, lights: false, compression: 0, distance: 0 };

  function applyDesign(next: CarDesign): void {
    design = { ...next };
    const { wheel: setting, lift } = designMeasurements(design);
    rideLift = lift;
    radiusDelta = setting.radius - 0.60;
    wheelRadius = setting.radius;
    paint.color.set(PAINTS.find((item) => item.id === design.paint)!.color);
    runningGear.position.y = radiusDelta;
    const scale = setting.radius / 0.60;
    wheels.forEach((mount) => {
      mount.position.x = Math.sign(mount.position.x) * setting.track;
      mount.scale.set(scale * setting.width, scale, scale);
    });
    spare.scale.set(0.84 * scale * setting.width, 0.84 * scale, 0.84 * scale);
    for (const variants of wheelStyles) {
      for (const item of WHEELS) variants[item.id].visible = item.id === design.wheels;
    }
    for (const arch of arches) {
      arch.mesh.position.x = arch.side * (Math.max(W + 0.10, setting.track + 0.14));
      arch.mesh.scale.set(1, scale, scale);
      arch.bridge.position.set(arch.side * (W + arch.mesh.position.x * arch.side) / 2, 0.60 + 1.00 * scale, arch.mesh.position.z);
      arch.bridge.scale.x = Math.max(0.02, arch.mesh.position.x * arch.side - W + 0.10);
    }
    cargo.visible = design.roof === 'cargo';
    tent.visible = design.roof === 'tent';
    const stepY = 0.80 - lift * 0.7;
    for (const step of sideSteps) {
      step.group.visible = lift > 0;
      step.group.position.y = stepY;
      const height = sillBottom - stepY + 0.03;
      step.brackets.forEach((bracket) => { bracket.scale.y = height; bracket.position.y = height / 2; });
    }
    applyPose(lastPose, lastGround);
  }

  const up = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  /**
   * `ground` is the road height under each wheel (front-left, front-right, rear-left, rear-right).
   * Wheels follow their own patch of ground; the body rides on the average and tilts with the differences.
   */
  function applyPose(pose: CarPose, ground: WheelGround = [0, 0, 0, 0]): void {
    lastPose = { ...pose };
    lastGround = [ground[0], ground[1], ground[2], ground[3]];
    const average = (ground[0] + ground[1] + ground[2] + ground[3]) / 4;
    const pitch = Math.atan2((ground[0] + ground[1]) / 2 - (ground[2] + ground[3]) / 2, 2 * WHEEL_Z);
    const roll = Math.atan2((ground[1] + ground[3]) / 2 - (ground[0] + ground[2]) / 2, 2.38);
    body.position.y = radiusDelta + rideLift - pose.compression + average;
    body.rotation.set(pitch, 0, roll);
    body.updateMatrix();
    wheels.forEach((mount, index) => {
      mount.position.y = 0.60 + ground[index];
      mount.rotation.x = -pose.distance / wheelRadius;
    });
    setRod(axles[0], wheels[0].position, wheels[1].position);
    setRod(axles[1], wheels[2].position, wheels[3].position);
    doorPivots.forEach((pivot, index) => { pivot.rotation.y = doorSides[index] * pose.doors * 1.22; });
    hoodPivot.rotation.x = pose.hood * 1.13;
    trunkPivot.rotation.y = -pose.trunk * 1.52;
    springs.forEach((spring, index) => {
      spring.arm.position.y = 0.64 + ground[index];
      spring.seat.position.y = 0.64 + ground[index];
      spring.bottom.y = 0.64 + radiusDelta + ground[index];
      spring.top.copy(spring.local).applyMatrix4(body.matrix);
      direction.subVectors(spring.top, spring.bottom);
      spring.mesh.position.copy(spring.bottom);
      spring.mesh.scale.y = direction.length();
      spring.mesh.quaternion.setFromUnitVectors(up, direction.normalize());
      spring.cap.position.copy(spring.top);
      setRod(spring.damper, spring.bottom, spring.top);
    });
    if (lampsOn !== pose.lights) {
      lampsOn = pose.lights;
      headlamp.emissiveIntensity = lampsOn ? 3.0 : 0;
      taillamp.emissiveIntensity = lampsOn ? 1.1 : 0;
      taillamp.color.set(lampsOn ? '#b3231f' : '#762c26');
      lightGroup.visible = lampsOn;
    }
  }

  function inspect() {
    root.updateMatrixWorld(true);
    return {
      bodyY: body.position.y,
      wheelCenters: wheels.map((item) => item.getWorldPosition(new THREE.Vector3()).toArray()),
      springLengths: springs.map((spring) => spring.top.distanceTo(spring.bottom)),
      bodyPitch: body.rotation.x,
      bodyRoll: body.rotation.z,
      wheelSpin: wheels[0].rotation.x,
      doorAngles: doorPivots.map((pivot) => pivot.rotation.y),
      hoodAngle: hoodPivot.rotation.x,
      trunkAngle: trunkPivot.rotation.y,
      lampsOn,
      headlampEmission: headlamp.emissiveIntensity,
      design: { ...design },
      paintColor: '#' + paint.color.getHexString(),
      wheelRadii: wheels.map((wheel) => wheel.scale.y * 0.60),
      wheelStyles: wheelStyles.map((variants) => WHEELS.filter((item) => variants[item.id].visible).map((item) => item.id)),
      roof: { cargo: cargo.visible, tent: tent.visible },
      sideSteps: { visible: sideSteps[0].group.visible, y: sideSteps[0].group.position.y },
    };
  }

  return { root, body, applyPose, applyDesign, inspect };
}
