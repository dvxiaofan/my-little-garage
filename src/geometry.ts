import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const roundedGeometries = new Map<string, THREE.BufferGeometry>();
const cylinderGeometries = new Map<string, THREE.BufferGeometry>();
const up = new THREE.Vector3(0, 1, 0);
const direction = new THREE.Vector3();
const midpoint = new THREE.Vector3();

export function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  radius = 0.035,
): THREE.Mesh {
  const r = Math.min(radius, Math.min(...size) * 0.48);
  const key = [...size, r].join(',');
  let geometry = roundedGeometries.get(key);
  if (!geometry) {
    geometry = new RoundedBoxGeometry(...size, 3, r);
    roundedGeometries.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function cylinder(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  position: [number, number, number],
  material: THREE.Material,
  segments = 32,
): THREE.Mesh {
  const key = [radius, height, segments].join(',');
  let geometry = cylinderGeometries.get(key);
  if (!geometry) {
    geometry = new THREE.CylinderGeometry(radius, radius, height, segments);
    cylinderGeometries.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function rod(
  parent: THREE.Object3D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 12), material);
  mesh.castShadow = true;
  setRod(mesh, start, end);
  parent.add(mesh);
  return mesh;
}

export function setRod(mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3): void {
  direction.subVectors(end, start);
  mesh.scale.y = direction.length();
  midpoint.addVectors(start, end).multiplyScalar(0.5);
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(up, direction.normalize());
}

export function labelTexture(
  title: string,
  background: string,
  foreground: string,
  width = 256,
  height = 128,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.fillStyle = background;
  context.beginPath();
  context.roundRect(4, 4, width - 8, height - 8, height * 0.13);
  context.fill();
  context.fillStyle = foreground;
  context.font = '800 ' + height * 0.64 + 'px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(title, width / 2, height * 0.55);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
