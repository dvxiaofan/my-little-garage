import * as THREE from 'three';

/** One lap of road. The car drives exactly this far during a trip. */
export const ROAD_LENGTH = 96;
/** Half width of the driveable strip; wheel tracks stay inside it. */
export const ROAD_HALF_WIDTH = 2.6;
/** Largest bump height the road can produce (world units). */
export const ROAD_MAX_HEIGHT = 0.42;
/** Distance from the start where the road stays flat, so the car starts and stops level. */
export const ROAD_FLAT = 5;

const TWO_PI = Math.PI * 2;
/** Road surface height; a hair above the studio floor (-0.18) so the two never z-fight. */
const ROAD_Y = -0.17;

/**
 * Height of the road surface at position `z` along the lap (0..ROAD_LENGTH, periodic) and lateral `x`.
 * Several sine waves whose wavelengths divide ROAD_LENGTH keep the lap seamless.
 * A fade near the start makes the first and last few metres flat.
 */
export function roadHeight(z: number, x = 0): number {
  const s = ((z % ROAD_LENGTH) + ROAD_LENGTH) % ROAD_LENGTH;
  const bumps =
    0.20 * Math.sin(TWO_PI * s / 12) +
    0.12 * Math.sin(TWO_PI * s / 5.33 + 1.3) +
    0.07 * Math.sin(TWO_PI * s / 2.4 + 0.4) +
    0.06 * Math.sin(TWO_PI * s / 16 + 2.1) * Math.sin(TWO_PI * x / 6.5);
  const fromEdge = Math.min(s, ROAD_LENGTH - s);
  const fade = fromEdge >= ROAD_FLAT ? 1 : smooth(fromEdge / ROAD_FLAT);
  return Math.max(-ROAD_MAX_HEIGHT, Math.min(ROAD_MAX_HEIGHT, bumps)) * fade;
}

function smooth(t: number): number { return t * t * (3 - 2 * t); }

export interface Road {
  root: THREE.Group;
  /** Scroll the road so that lap distance `distance` sits under the car origin. */
  setDistance(distance: number): void;
}

/**
 * A strip three laps long so the visible window is always covered while the road scrolls
 * one lap length under the car. Scrolling happens by moving the mesh; heights are baked once.
 */
export function createRoad(): Road {
  const root = new THREE.Group();
  root.name = 'trail-road';
  const laps = 3;
  const length = ROAD_LENGTH * laps;
  const width = 30;
  const segmentsZ = Math.round(length / 0.4);
  const segmentsX = 40;
  const geometry = new THREE.PlaneGeometry(width, length, segmentsX, segmentsZ);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    // Beyond the strip the land rises into soft mounds, never below the studio floor.
    const off = Math.max(0, Math.abs(x) - ROAD_HALF_WIDTH);
    const shoulder = 0.16 * Math.min(off / 2.5, 1) * (0.5 + 0.5 * Math.sin(z * 0.45 + x * 0.8));
    // Local z maps to lap distance -z, so that after scrolling by `distance` the ground under
    // world z equals roadHeight(distance - z): the road ahead of the car (negative z) is what comes next.
    positions.setY(i, roadHeight(-z, x) + shoulder);
  }
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#c9b48c', roughness: 1 }));
  ground.receiveShadow = true;
  ground.position.y = ROAD_Y;
  root.add(ground);

  // Two darker wheel tracks and a few rocks give the eye something to see moving.
  const trackMaterial = new THREE.MeshStandardMaterial({ color: '#b39d76', roughness: 1 });
  for (const side of [-1, 1]) {
    const track = new THREE.PlaneGeometry(0.7, length, 1, segmentsZ);
    track.rotateX(-Math.PI / 2);
    const p = track.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, roadHeight(-p.getZ(i), side * 1.12) + 0.012);
    track.computeVertexNormals();
    const mesh = new THREE.Mesh(track, trackMaterial);
    mesh.position.set(side * 1.12, ROAD_Y, 0);
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  const rock = new THREE.DodecahedronGeometry(0.22, 0);
  const rockMaterial = new THREE.MeshStandardMaterial({ color: '#8d867a', roughness: 0.95 });
  const rocks = new THREE.InstancedMesh(rock, rockMaterial, 3 * laps * 8);
  const dummy = new THREE.Object3D();
  let index = 0;
  for (const lap of [-1, 0, 1]) {
    for (let i = 0; i < 8; i++) {
      const s = 8 + i * 11 + (i % 3) * 1.7;
      const side = i % 2 ? 1 : -1;
      const x = side * (ROAD_HALF_WIDTH + 0.9 + (i % 4) * 0.7);
      const z = -(lap * ROAD_LENGTH + s);
      dummy.position.set(x, roadHeight(s, x) + ROAD_Y + 0.10, z);
      dummy.rotation.set(i * 0.7, i * 1.3, 0);
      dummy.scale.setScalar(0.7 + (i % 3) * 0.35);
      dummy.updateMatrix();
      rocks.setMatrixAt(index++, dummy.matrix);
    }
  }
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  root.add(rocks);
  return {
    root,
    setDistance(distance: number): void {
      const s = ((distance % ROAD_LENGTH) + ROAD_LENGTH) % ROAD_LENGTH;
      root.position.z = s;
    },
  };
}
