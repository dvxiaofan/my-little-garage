import * as THREE from 'three';
import { box, cylinder, labelTexture, rod, setRod } from './geometry.ts';
import type { CarPose } from './controller.ts';
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

  const paint = new THREE.MeshPhysicalMaterial({ color: '#e98246', roughness: 0.38, metalness: 0.04, clearcoat: 0.55, clearcoatRoughness: 0.25 });
  const cream = new THREE.MeshStandardMaterial({ color: '#f1e8d3', roughness: 0.48 });
  const dark = new THREE.MeshStandardMaterial({ color: '#34413d', roughness: 0.58 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#27302e', roughness: 0.93 });
  const rubberEdge = new THREE.MeshStandardMaterial({ color: '#36403c', roughness: 0.85 });
  const silver = new THREE.MeshStandardMaterial({ color: '#b0bcb7', roughness: 0.33, metalness: 0.72 });
  const seat = new THREE.MeshStandardMaterial({ color: '#786551', roughness: 0.92 });
  const fabric = new THREE.MeshStandardMaterial({ color: '#a38b69', roughness: 0.95 });
  const coilPaint = new THREE.MeshStandardMaterial({ color: '#f5bf48', roughness: 0.37, metalness: 0.24 });
  const red = new THREE.MeshStandardMaterial({ color: '#d65037', roughness: 0.48 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#8eaaa5', roughness: 0.12, metalness: 0.12, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
  const headlamp = new THREE.MeshStandardMaterial({ color: '#f1e4bd', emissive: '#ffdc7f', emissiveIntensity: 0, roughness: 0.23, metalness: 0.15 });
  const taillamp = new THREE.MeshStandardMaterial({ color: '#762c26', emissive: '#ff1510', emissiveIntensity: 0, roughness: 0.3 });
  const amber = new THREE.MeshStandardMaterial({ color: '#edb554', roughness: 0.4 });

  // The floor and all opening parts belong to the sprung body. Wheels remain on the ground.
  box(body, [1.75, 0.18, 3.80], [0, 1.13, 0], dark);
  for (const side of [-1, 1]) {
    box(body, [0.13, 0.17, 3.48], [side * 0.65, 1.00, 0], dark);
  }
  box(body, [1.98, 0.13, 2.73], [0, 1.38, 0.61], paint, 0.045);
  box(body, [1.72, 0.06, 2.56], [0, 1.48, 0.63], dark, 0.02);

  // Engine bay: a real opening between the wings, front grille and dashboard.
  box(body, [1.76, 0.09, 1.29], [0, 1.40, -1.38], dark);
  for (const side of [-1, 1]) {
    box(body, [0.18, 0.36, 1.37], [side * 0.98, 1.59, -1.40], paint, 0.055);
    box(body, [0.12, 0.10, 1.36], [side * 1.04, 1.77, -1.40], paint);
  }
  box(body, [2.06, 0.48, 0.17], [0, 1.55, -2.04], paint, 0.06);
  box(body, [0.92, 0.24, 0.67], [0, 1.59, -1.42], silver);
  box(body, [0.58, 0.07, 0.46], [0, 1.74, -1.42], dark);
  for (let i = 0; i < 5; i++) {
    box(body, [0.065, 0.08, 0.48], [-0.24 + i * 0.12, 1.77, -1.42], silver, 0.014);
  }
  box(body, [0.33, 0.20, 0.32], [0.65, 1.58, -1.06], dark);
  cylinder(body, 0.08, 0.04, [0.65, 1.70, -1.06], red);
  rod(body, new THREE.Vector3(-0.5, 1.58, -1.18), new THREE.Vector3(-0.6, 1.62, -1.81), 0.045, dark);

  // Friendly round headlights, a slotted grille and chunky toy bumpers.
  box(body, [1.04, 0.30, 0.055], [0, 1.58, -2.145], dark);
  for (let i = 0; i < 5; i++) {
    box(body, [0.068, 0.24, 0.055], [-0.36 + i * 0.18, 1.58, -2.18], cream, 0.015);
  }
  const lightGroup = new THREE.Group();
  body.add(lightGroup);
  for (const side of [-1, 1]) {
    const bezel = cylinder(body, 0.255, 0.095, [side * 0.77, 1.59, -2.115], dark);
    bezel.rotation.x = Math.PI / 2;
    const lamp = cylinder(body, 0.205, 0.046, [side * 0.77, 1.59, -2.18], headlamp);
    lamp.rotation.x = Math.PI / 2;
    box(body, [0.19, 0.075, 0.04], [side * 0.79, 1.29, -2.15], amber, 0.02);
    const light = new THREE.SpotLight('#ffe1a0', 14, 8, 0.48, 0.85, 1.5);
    light.position.set(side * 0.77, 1.59, -2.28);
    light.target.position.set(side * 0.9, 0, -5.3);
    lightGroup.add(light, light.target);
  }
  lightGroup.visible = false;
  box(body, [2.35, 0.23, 0.33], [0, 1.15, -2.15], dark, 0.07);
  box(body, [1.30, 0.075, 0.35], [0, 1.01, -2.12], silver);
  for (const side of [-1, 1]) {
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.024, 10, 20), red);
    hook.position.set(side * 0.59, 1.07, -2.35);
    body.add(hook);
  }

  // Cabin, transparent windows, dashboard, seats and a little steering wheel.
  box(body, [2.13, 0.17, 2.71], [0, 2.78, 0.66], cream, 0.075);
  box(body, [2.16, 0.045, 2.76], [0, 2.685, 0.66], dark, 0.02);
  const windshield = box(body, [1.85, 0.73, 0.024], [0, 2.30, -0.663], glass, 0.008);
  windshield.rotation.x = 0.13;
  box(body, [1.95, 0.11, 0.10], [0, 1.91, -0.72], paint);
  for (const side of [-1, 1]) {
    rod(body, new THREE.Vector3(side * 1.00, 1.91, -0.73), new THREE.Vector3(side * 1.00, 2.69, -0.62), 0.055, paint);
    box(body, [0.12, 1.25, 0.12], [side * 1.015, 2.08, 0.66], paint);
    box(body, [0.12, 1.25, 0.16], [side * 1.015, 2.08, 1.87], paint);
    box(body, [0.105, 0.52, 1.18], [side * 1.02, 1.72, 1.27], paint, 0.035);
    box(body, [0.026, 0.61, 1.02], [side * 1.03, 2.33, 1.27], glass, 0.009);
    box(body, [0.10, 0.055, 1.17], [side * 1.045, 1.998, 1.28], dark, 0.012);
    box(body, [0.28, 0.10, 1.31], [side * 1.14, 1.31, 0.08], dark);
    box(body, [0.05, 0.07, 2.28], [side * 0.78, 2.91, 0.67], dark, 0.018);
  }
  for (const z of [-0.36, 0.65, 1.69]) {
    box(body, [1.64, 0.06, 0.065], [0, 2.91, z], dark, 0.018);
  }

  const cargo = new THREE.Group();
  cargo.name = 'roof-cargo';
  const luggagePaint = new THREE.MeshStandardMaterial({ color: '#a4ad8b', roughness: 0.68 });
  box(cargo, [1.43, 0.29, 1.72], [0, 3.105, 0.67], luggagePaint, 0.095);
  box(cargo, [1.44, 0.025, 1.73], [0, 3.095, 0.67], dark, 0.011);
  for (const x of [-0.46, 0.46]) {
    box(cargo, [0.075, 0.025, 1.64], [x, 3.252, 0.67], cream, 0.011);
    for (const z of [-0.18, 1.52]) box(cargo, [0.075, 0.23, 0.024], [x, 3.12, z], cream, 0.009);
  }
  box(cargo, [0.27, 0.055, 0.045], [0, 3.10, -0.218], dark, 0.02);

  const tent = new THREE.Group();
  tent.name = 'roof-tent';
  box(tent, [1.67, 0.095, 1.96], [0, 2.99, 0.66], dark, 0.025);
  const canvas = new THREE.MeshStandardMaterial({ color: '#dbbd7b', roughness: 0.95, side: THREE.DoubleSide });
  const tentShape = new THREE.Shape().moveTo(-0.77, 0).lineTo(0, 0.58).lineTo(0.77, 0).closePath();
  const canopy = new THREE.Mesh(new THREE.ExtrudeGeometry(tentShape, { depth: 1.79, bevelEnabled: false, steps: 1 }), canvas);
  canopy.position.set(0, 3.04, -0.235);
  canopy.castShadow = true;
  canopy.receiveShadow = true;
  tent.add(canopy);
  const openingShape = new THREE.Shape().moveTo(-0.43, 0).lineTo(0, 0.44).lineTo(0.43, 0).closePath();
  const opening = new THREE.Mesh(new THREE.ShapeGeometry(openingShape), new THREE.MeshStandardMaterial({ color: '#526557', roughness: 1, side: THREE.DoubleSide }));
  opening.position.set(0, 3.044, -0.24);
  tent.add(opening);
  for (const z of [-0.243, 1.56]) {
    for (const side of [-1, 1]) rod(tent, new THREE.Vector3(side * 0.77, 3.04, z), new THREE.Vector3(0, 3.625, z), 0.022, cream);
  }
  rod(tent, new THREE.Vector3(0, 3.625, -0.25), new THREE.Vector3(0, 3.625, 1.57), 0.025, dark);
  rod(tent, new THREE.Vector3(0, 3.05, -0.25), new THREE.Vector3(0, 3.46, -0.25), 0.012, cream);
  cylinder(tent, 0.08, 1.08, [0, 3.07, 1.61], luggagePaint).rotation.z = Math.PI / 2;
  cargo.visible = false;
  tent.visible = false;
  body.add(cargo, tent);
  box(body, [1.78, 0.25, 0.32], [0, 1.96, -0.52], dark, 0.045);
  for (const side of [-1, 1]) {
    box(body, [0.54, 0.18, 0.59], [side * 0.48, 1.64, 0.14], seat, 0.07);
    const back = box(body, [0.53, 0.67, 0.17], [side * 0.48, 1.98, 0.44], seat, 0.06);
    back.rotation.x = -0.07;
    box(body, [0.39, 0.46, 0.028], [side * 0.48, 1.99, 0.338], fabric);
    box(body, [0.35, 0.20, 0.18], [side * 0.48, 2.37, 0.46], seat, 0.07);
  }
  rod(body, new THREE.Vector3(-0.49, 1.93, -0.47), new THREE.Vector3(-0.49, 2.05, -0.19), 0.035, silver);
  const steering = new THREE.Group();
  steering.position.set(-0.49, 2.05, -0.18);
  steering.rotation.x = -0.32;
  steering.add(new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.026, 10, 32), dark));
  box(steering, [0.32, 0.035, 0.025], [0, 0, 0], dark, 0.009);
  box(steering, [0.035, 0.19, 0.025], [0, -0.07, 0], dark, 0.009);
  body.add(steering);
  box(body, [0.18, 0.06, 0.22], [0, 1.59, 0.05], dark);
  rod(body, new THREE.Vector3(0, 1.62, 0.03), new THREE.Vector3(0, 1.82, 0.01), 0.025, silver);

  const numberMaterial = new THREE.MeshBasicMaterial({ map: makeLabel('01', '#f7edd9', '#37453b'), transparent: true, depthWrite: false });
  const doorPivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? 'left-door-hinge' : 'right-door-hinge';
    pivot.position.set(side * 1.06, 1.95, -0.60);
    body.add(pivot);
    box(pivot, [0.105, 0.55, 1.15], [0, -0.235, 0.59], paint, 0.03);
    box(pivot, [0.025, 0.59, 1.015], [0, 0.37, 0.59], glass, 0.009);
    box(pivot, [0.095, 0.065, 1.15], [0, 0.04, 0.59], dark, 0.02);
    box(pivot, [0.085, 0.060, 1.15], [0, 0.69, 0.59], paint, 0.016);
    for (const z of [0.045, 1.14]) box(pivot, [0.082, 0.64, 0.065], [0, 0.36, z], paint, 0.016);
    box(pivot, [0.072, 0.085, 0.23], [side * 0.085, -0.045, 0.93], dark, 0.025);
    box(pivot, [0.13, 0.055, 0.10], [side * 0.11, 0.37, 0.045], dark, 0.018);
    box(pivot, [0.23, 0.16, 0.26], [side * 0.23, 0.39, 0.045], paint, 0.04);
    box(pivot, [0.018, 0.115, 0.19], [side * 0.353, 0.39, 0.045], silver, 0.008);
    box(pivot, [0.017, 0.35, 0.86], [-side * 0.063, -0.21, 0.59], seat, 0.008);
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.49, 0.245), numberMaterial);
    decal.position.set(side * 0.058, -0.24, 0.56);
    decal.rotation.y = side * Math.PI / 2;
    pivot.add(decal);
    doorPivots.push(pivot);
  }

  // Side steps drop out under the doors when the chassis is raised, so the driver can still climb in.
  const sideSteps: Array<{ group: THREE.Group; brackets: THREE.Mesh[]; side: number }> = [];
  for (const side of [-1, 1]) {
    const group = new THREE.Group();
    group.name = side < 0 ? 'left-side-step' : 'right-side-step';
    box(group, [0.17, 0.045, 1.00], [side * 1.20, 0, 0], dark, 0.02);
    for (const z of [-0.36, -0.12, 0.12, 0.36]) box(group, [0.15, 0.014, 0.05], [side * 1.20, 0.028, z], silver, 0.005);
    const brackets = [-0.34, 0.34].map((z) => rod(body, new THREE.Vector3(side * 1.08, 0.92, z), new THREE.Vector3(side * 1.16, 0.70, z), 0.03, dark));
    group.visible = false;
    brackets.forEach((item) => { item.visible = false; });
    body.add(group);
    sideSteps.push({ group, brackets, side });
  }

  const hoodPivot = new THREE.Group();
  hoodPivot.name = 'hood-hinge';
  hoodPivot.position.set(0, 1.825, -0.745);
  body.add(hoodPivot);
  box(hoodPivot, [1.87, 0.12, 1.29], [0, 0, -0.645], paint, 0.05);
  for (const x of [-0.49, 0.49]) box(hoodPivot, [0.065, 0.022, 0.84], [x, 0.063, -0.66], paint, 0.01);
  box(hoodPivot, [1.2, 0.045, 0.82], [0, -0.079, -0.66], dark);

  // The cargo floor and a few boxes are visible once the rear door swings open.
  box(body, [1.72, 0.055, 1.19], [0, 1.49, 1.23], seat);
  box(body, [0.65, 0.28, 0.48], [-0.38, 1.66, 1.30], cream, 0.035);
  for (const x of [-0.61, -0.37, -0.14]) box(body, [0.045, 0.02, 0.48], [x, 1.809, 1.30], fabric, 0.008);
  box(body, [0.35, 0.24, 0.38], [0.41, 1.64, 1.43], dark);
  // Side-hinged rear door like a real off-roader: hinges on the right edge, spare tyre carried on the door.
  const hingeX = 0.885;
  const trunkPivot = new THREE.Group();
  trunkPivot.name = 'trunk-hinge';
  trunkPivot.position.set(hingeX, 2.67, 1.96);
  body.add(trunkPivot);
  box(trunkPivot, [1.77, 0.54, 0.11], [-hingeX, -0.99, 0], paint, 0.035);
  box(trunkPivot, [1.59, 0.60, 0.027], [-hingeX, -0.345, 0.014], glass, 0.009);
  for (const x of [-0.858, 0.858]) box(trunkPivot, [0.07, 0.65, 0.08], [x - hingeX, -0.335, 0], paint);
  box(trunkPivot, [1.77, 0.065, 0.10], [-hingeX, -0.035, 0], paint);
  box(trunkPivot, [1.77, 0.06, 0.12], [-hingeX, -0.66, 0], dark);
  box(trunkPivot, [0.085, 0.065, 0.23], [-hingeX - 0.70, -0.88, 0.084], dark, 0.02);
  for (const y of [-0.15, -0.85]) box(body, [0.07, 0.17, 0.09], [hingeX + 0.06, 2.67 + y, 1.985], dark, 0.02);
  box(body, [2.34, 0.22, 0.29], [0, 1.16, 2.08], dark, 0.06);
  for (const side of [-1, 1]) {
    box(body, [0.19, 0.34, 0.12], [side * 1.00, 1.72, 2.014], dark);
    box(body, [0.13, 0.21, 0.025], [side * 1.00, 1.76, 2.09], taillamp, 0.018);
    box(body, [0.13, 0.065, 0.025], [side * 1.00, 1.605, 2.09], cream, 0.012);
  }

  function wheel(side: number, kind: WheelId): THREE.Group {
    const group = new THREE.Group();
    group.name = 'wheel-style-' + kind;
    const rimMaterial = kind === 'road' ? silver : kind === 'crawler' ? coilPaint : cream;
    cylinder(group, kind === 'road' ? 0.592 : 0.576, 0.39, [0, 0, 0], rubber, 48).rotation.z = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.07, 12, 48), rubberEdge);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = side * 0.18;
    group.add(ring);
    cylinder(group, 0.36, 0.025, [side * 0.213, 0, 0], rimMaterial, 40).rotation.z = Math.PI / 2;
    cylinder(group, 0.286, 0.035, [side * 0.23, 0, 0], dark, 40).rotation.z = Math.PI / 2;
    cylinder(group, 0.125, 0.06, [side * 0.258, 0, 0], rimMaterial).rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      const spoke = box(group, [0.038, 0.24, kind === 'road' ? 0.04 : 0.067], [side * 0.257, Math.cos(angle) * 0.185, Math.sin(angle) * 0.185], rimMaterial, 0.016);
      spoke.rotation.x = angle;
      cylinder(group, 0.023, 0.064, [side * 0.27, Math.cos(angle) * 0.082, Math.sin(angle) * 0.082], silver, 10).rotation.z = Math.PI / 2;
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
  const arches: Array<{ mesh: THREE.Mesh; bridge: THREE.Mesh; side: number }> = [];
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
  const springs: Array<{ mesh: THREE.Mesh; cap: THREE.Mesh; damper: THREE.Mesh; bottom: THREE.Vector3; top: THREE.Vector3 }> = [];
  const coilGeometry = new THREE.TubeGeometry(new CoilCurve(), 144, 0.023, 7, false);
  for (const z of [-1.35, 1.35]) {
    const axle = cylinder(runningGear, 0.095, 2.35, [0, 0.60, z], dark);
    axle.rotation.z = Math.PI / 2;
    axles.push(axle);
    for (const side of [-1, 1]) {
      const tire = wheelSet(side);
      tire.position.set(side * 1.19, 0.60, z);
      tire.name = 'grounded-wheel-' + side + '-' + z;
      runningGear.add(tire);
      wheels.push(tire);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.095, 10, 40, Math.PI - 0.86), dark);
      arch.position.set(side * 1.08, 0.60, z);
      arch.rotation.set(0, Math.PI / 2, 0.43);
      arch.castShadow = true;
      body.add(arch);
      const bridge = box(body, [1, 0.085, 0.50], [side * 1.04, 1.38, z], dark, 0.025);
      bridge.scale.x = 0.19;
      arches.push({ mesh: arch, bridge, side });
      // Exposed trailing-arm springs are visible between the wheels, below the door sill.
      const springZ = Math.sign(z) * 0.56;
      const bottom = new THREE.Vector3(side * 0.97, 0.64, springZ);
      const top = new THREE.Vector3(side * 0.97, 1.22, springZ);
      rod(runningGear, new THREE.Vector3(side * 0.97, 0.64, z), bottom, 0.055, dark);
      box(body, [0.30, 0.07, 0.24], [side * 0.86, 1.24, springZ], dark);
      const coil = new THREE.Mesh(coilGeometry, coilPaint);
      coil.position.copy(bottom);
      coil.scale.y = top.y - bottom.y;
      coil.castShadow = true;
      root.add(coil);
      cylinder(runningGear, 0.14, 0.045, [bottom.x, bottom.y, bottom.z], dark);
      const cap = cylinder(root, 0.14, 0.045, [top.x, top.y, top.z], silver);
      const damper = rod(root, bottom, top, 0.033, silver);
      springs.push({ mesh: coil, cap, damper, bottom, top });
    }
  }
  const spare = wheelSet(1);
  spare.scale.setScalar(0.72);
  spare.rotation.y = -Math.PI / 2;
  spare.position.set(-hingeX, -0.77, 0.28);
  trunkPivot.add(spare);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.20), new THREE.MeshBasicMaterial({ map: makeLabel('LITTLE', '#eee7d7', '#34413d', 384, 112) }));
  plate.position.set(0, 1.185, 2.231);
  body.add(plate);
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.material === glass) object.castShadow = false;
  });

  let lampsOn = false;
  let design: CarDesign = { ...DEFAULT_DESIGN };
  let rideLift = 0;
  let radiusDelta = 0;
  let lastPose: CarPose = { doors: 0, hood: 0, trunk: 0, lights: false, compression: 0 };

  function applyDesign(next: CarDesign): void {
    design = { ...next };
    const { wheel: setting, lift } = designMeasurements(design);
    rideLift = lift;
    radiusDelta = setting.radius - 0.60;
    paint.color.set(PAINTS.find((item) => item.id === design.paint)!.color);
    runningGear.position.y = radiusDelta;
    const scale = setting.radius / 0.60;
    wheels.forEach((mount) => {
      mount.position.x = Math.sign(mount.position.x) * setting.track;
      mount.scale.set(scale * setting.width, scale, scale);
    });
    spare.scale.set(0.72 * scale * setting.width, 0.72 * scale, 0.72 * scale);
    for (const variants of wheelStyles) {
      for (const item of WHEELS) variants[item.id].visible = item.id === design.wheels;
    }
    for (const arch of arches) {
      arch.mesh.position.x = arch.side * (setting.track - 0.11);
      arch.mesh.scale.setScalar(scale);
      arch.bridge.position.set(arch.side * (1 + setting.track - 0.11) / 2, 0.60 + 0.78 * scale, arch.mesh.position.z);
      arch.bridge.scale.x = setting.track - 0.95;
    }
    for (const axle of axles) axle.scale.y = setting.track / 1.19;
    cargo.visible = design.roof === 'cargo';
    tent.visible = design.roof === 'tent';
    const stepY = 0.86 - lift * 1.05;
    for (const step of sideSteps) {
      step.group.visible = lift > 0;
      step.group.position.y = stepY;
      step.brackets.forEach((bracket, index) => {
        bracket.visible = lift > 0;
        const z = index === 0 ? -0.34 : 0.34;
        setRod(bracket, new THREE.Vector3(step.side * 1.08, 0.92, z), new THREE.Vector3(step.side * 1.18, stepY + 0.02, z));
      });
    }
    applyPose(lastPose);
  }

  function applyPose(pose: CarPose): void {
    lastPose = { ...pose };
    body.position.y = radiusDelta + rideLift - pose.compression;
    doorPivots[0].rotation.y = -pose.doors * 1.22;
    doorPivots[1].rotation.y = pose.doors * 1.22;
    hoodPivot.rotation.x = pose.hood * 1.13;
    trunkPivot.rotation.y = pose.trunk * 1.52;
    for (const spring of springs) {
      spring.bottom.y = 0.64 + radiusDelta;
      spring.mesh.position.y = spring.bottom.y;
      spring.top.y = 1.22 + radiusDelta + rideLift - pose.compression;
      spring.mesh.scale.y = spring.top.y - spring.bottom.y;
      spring.cap.position.copy(spring.top);
      setRod(spring.damper, spring.bottom, spring.top);
    }
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
      springLengths: springs.map((spring) => spring.top.y - spring.bottom.y),
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
