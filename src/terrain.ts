import * as THREE from 'three';

export const ROAD_LENGTH = 96;
export const ROAD_HALF_WIDTH = 2.6;
export const ROAD_MAX_HEIGHT = 0.42;
/** Completely level apron, longer than the wheelbase, followed by a smooth transition. */
export const ROAD_FLAT = 5;
export const ROAD_OPTIONS = [
  { id: 'flat', label: '平路', description: '稳稳向前，看看轮子怎么转', path: 'M2 18 H46' },
  { id: 'hills', label: '连续小坡', description: '上坡下坡，看看车头怎么动', path: 'M2 18 Q8 2 14 18 T26 18 T38 18 T46 18' },
  { id: 'alternating', label: '交错起伏', description: '左右起伏，看看四个轮子的不同', path: 'M2 12 Q8 0 14 12 T26 12 T38 12 T46 12 M2 22 Q8 34 14 22 T26 22 T38 22 T46 22' },
] as const;
export type RoadKind = typeof ROAD_OPTIONS[number]['id'];
export const DEFAULT_ROAD: RoadKind = 'hills';
const TWO_PI = Math.PI * 2;

/** Same height function drives the visible mesh, tracks and all four wheel contacts. */
export function roadHeight(z: number, x = 0, kind: RoadKind = DEFAULT_ROAD): number {
  if (kind === 'flat') return 0;
  const s = ((z % ROAD_LENGTH) + ROAD_LENGTH) % ROAD_LENGTH;
  const fromEdge = Math.min(s, ROAD_LENGTH - s);
  const t = Math.max(0, Math.min(1, (fromEdge - ROAD_FLAT) / ROAD_FLAT));
  const fade = t * t * (3 - 2 * t);
  const height = kind === 'hills'
    ? 0.32 * Math.sin(TWO_PI * s / 16)
    : 0.10 * Math.sin(TWO_PI * s / 24) + 0.28 * Math.sin(TWO_PI * s / 16) * Math.max(-1, Math.min(1, x / 1.12));
  return height * fade;
}

export interface Road {
  root: THREE.Group;
  setKind(kind: RoadKind): void;
  setDistance(distance: number): void;
}

/** Reuse the same geometry and materials when selecting a new road. */
export function createRoad(initialKind: RoadKind = DEFAULT_ROAD): Road {
  const root = new THREE.Group();
  root.name = 'trail-road';
  const length = ROAD_LENGTH * 3;
  const segmentsZ = Math.round(length / 0.4);
  const geometry = new THREE.PlaneGeometry(30, length, 40, segmentsZ);
  geometry.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#c9b48c', roughness: 1 }));
  ground.receiveShadow = true;
  root.add(ground);
  const trackMaterial = new THREE.MeshStandardMaterial({ color: '#b39d76', roughness: 1 });
  const tracks = [-1, 1].map((side) => {
    const track = new THREE.PlaneGeometry(0.7, length, 1, segmentsZ);
    track.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(track, trackMaterial);
    mesh.position.x = side * 1.12;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  });
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.22, 0),
    new THREE.MeshStandardMaterial({ color: '#8d867a', roughness: 0.95 }),
    24,
  );
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  root.add(rocks);
  const dummy = new THREE.Object3D();
  function shoulder(z: number, x: number): number {
    const off = Math.max(0, Math.abs(x) - ROAD_HALF_WIDTH);
    return 0.16 * Math.min(off / 2.5, 1) * (0.5 + 0.5 * Math.sin(z * 0.45 + x * 0.8));
  }
  function setKind(kind: RoadKind): void {
    for (const mesh of [ground, ...tracks]) {
      const p = mesh.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) + mesh.position.x;
        const z = p.getZ(i);
        p.setY(i, roadHeight(-z, x, kind) + shoulder(z, x) + (mesh === ground ? 0 : 0.012));
      }
      p.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingBox();
      mesh.geometry.computeBoundingSphere();
    }
    let index = 0;
    for (const lap of [-1, 0, 1]) {
      for (let i = 0; i < 8; i++) {
        const s = 8 + i * 11 + (i % 3) * 1.7;
        const x = (i % 2 ? 1 : -1) * (ROAD_HALF_WIDTH + 0.9 + (i % 4) * 0.7);
        const z = -(lap * ROAD_LENGTH + s);
        dummy.position.set(x, roadHeight(-z, x, kind) + shoulder(z, x) + 0.10, z);
        dummy.rotation.set(i * 0.7, i * 1.3, 0);
        dummy.scale.setScalar(0.7 + (i % 3) * 0.35);
        dummy.updateMatrix();
        rocks.setMatrixAt(index++, dummy.matrix);
      }
    }
    rocks.instanceMatrix.needsUpdate = true;
    rocks.computeBoundingSphere();
  }
  setKind(initialKind);
  return {
    root, setKind,
    setDistance(distance: number): void {
      root.position.z = ((distance % ROAD_LENGTH) + ROAD_LENGTH) % ROAD_LENGTH;
    },
  };
}
