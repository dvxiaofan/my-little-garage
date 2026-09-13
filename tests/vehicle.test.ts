import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createVehicle } from '../src/vehicle.ts';
import { DEFAULT_DESIGN, PAINTS, WHEELS, HEIGHTS, ROOFS } from '../src/customization.ts';

// Labels are decorative. A texture without a canvas lets us test real model transforms in Node.
function makeRig() {
  return createVehicle(() => new THREE.CanvasTexture({ width: 1, height: 1 } as HTMLCanvasElement));
}
const closed = { doors: 0, hood: 0, trunk: 0, lights: false, compression: 0 };

test('compression moves the body and shortens every spring while all wheel centers stay fixed', () => {
  const rig = makeRig();
  rig.applyPose(closed);
  const before = rig.inspect();
  rig.applyPose({ doors: 1, hood: 1, trunk: 1, lights: true, compression: 0.24 });
  const after = rig.inspect();
  assert.deepEqual(after.wheelCenters, before.wheelCenters);
  assert.ok(Math.abs(after.bodyY - before.bodyY + 0.24) < 1e-9);
  after.springLengths.forEach((length, index) => {
    assert.ok(length > 0);
    assert.ok(Math.abs(before.springLengths[index] - length - 0.24) < 1e-9);
  });
  assert.equal(after.lampsOn, true);
  assert.ok(after.headlampEmission > 0);
});

test('doors open outwards; hood rises; rear door swings sideways toward the back without lifting', () => {
  const rig = makeRig();
  const names = ['left-door-hinge', 'right-door-hinge', 'hood-hinge', 'trunk-hinge'];
  const centers = () => {
    rig.root.updateMatrixWorld(true);
    return names.map((name) => rig.root.getObjectByName(name)!.children[0].getWorldPosition(new THREE.Vector3()));
  };
  rig.applyPose(closed);
  const before = centers();
  rig.applyPose({ ...closed, doors: 1, hood: 1, trunk: 1 });
  const after = centers();
  assert.ok(after[0].x < before[0].x - 0.3);
  assert.ok(after[1].x > before[1].x + 0.3);
  assert.ok(after[2].y > before[2].y + 0.3);
  assert.ok(Math.abs(after[3].y - before[3].y) < 1e-9);
  assert.ok(after[3].z > before[3].z + 0.5);
  assert.ok(after[3].x > before[3].x + 0.5);
});

test('restoring the pose after combined actions restores actual geometry and lamp materials', () => {
  const rig = makeRig();
  rig.applyPose(closed);
  const original = rig.inspect();
  rig.applyPose({ doors: 0.6, hood: 1, trunk: 0.8, lights: true, compression: -0.04 });
  rig.applyPose(closed);
  assert.deepEqual(rig.inspect(), original);
});

test('every wheel, ride height and roof combination keeps wheel contact and coherent suspension throughout compression', () => {
  const rig = makeRig();
  for (const wheel of WHEELS) for (const height of HEIGHTS) for (const roof of ROOFS) {
    rig.applyDesign({ ...DEFAULT_DESIGN, wheels: wheel.id, height: height.id, roof: roof.id });
    for (const compression of [0, 0.24, -0.055]) {
      rig.applyPose({ doors: 1, hood: 1, trunk: 1, lights: true, compression });
      const actual = rig.inspect();
      assert.ok(Math.abs(actual.bodyY - (wheel.radius - 0.60 + height.lift - compression)) < 1e-9);
      actual.wheelCenters.forEach((center, i) => {
        assert.ok(Math.abs(center[1] - actual.wheelRadii[i] - 0.018) < 1e-9);
        assert.ok(Math.abs(Math.abs(center[0]) - wheel.track) < 1e-9);
      });
      actual.springLengths.forEach((length) => {
        assert.ok(length > 0.3);
        assert.ok(Math.abs(length - (0.58 + height.lift - compression)) < 1e-9);
      });
      assert.deepEqual(actual.wheelStyles, Array.from({ length: 5 }, () => [wheel.id]));
      assert.equal(actual.roof.cargo, roof.id === 'cargo');
      assert.equal(actual.roof.tent, roof.id === 'tent');
      assert.equal(actual.lampsOn, true);
      assert.equal(actual.hoodAngle, 1.13);
    }
  }
});

test('changing paint updates every opening panel; customization preserves an in-progress pose and reuses geometry', () => {
  const rig = makeRig();
  const ids = () => {
    const result: number[] = [];
    rig.root.traverse((object) => { if (object instanceof THREE.Mesh) result.push(object.geometry.id); });
    return result;
  };
  const geometryIds = ids();
  const pose = { doors: 0.5, hood: 0.6, trunk: 0.7, lights: true, compression: 0.16 };
  rig.applyPose(pose);
  for (const paint of PAINTS) {
    rig.applyDesign({ ...DEFAULT_DESIGN, paint: paint.id, height: 'high', roof: 'tent', wheels: 'crawler' });
    for (const name of ['left-door-hinge', 'right-door-hinge', 'hood-hinge', 'trunk-hinge']) {
      const panel = rig.root.getObjectByName(name)!.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
      assert.equal('#' + panel.material.color.getHexString(), paint.color);
    }
    const state = rig.inspect();
    assert.equal(state.doorAngles[0], -pose.doors * 1.22);
    assert.equal(state.trunkAngle, pose.trunk * 1.52);
    assert.equal(state.lampsOn, true);
    assert.ok(Math.abs(state.bodyY - (0.12 + 0.34 - pose.compression)) < 1e-9);
  }
  assert.deepEqual(ids(), geometryIds);
});

test('side steps appear only when the chassis is raised and hang below the sill at a steady height above ground', () => {
  const rig = makeRig();
  for (const wheel of WHEELS) for (const height of HEIGHTS) {
    rig.applyDesign({ ...DEFAULT_DESIGN, wheels: wheel.id, height: height.id });
    rig.applyPose(closed);
    const state = rig.inspect();
    assert.equal(state.sideSteps.visible, height.lift > 0, wheel.id + '/' + height.id);
    if (height.lift > 0) {
      const worldY = state.bodyY + state.sideSteps.y;
      assert.ok(worldY > 0.55 && worldY < 1.1, 'step world height ' + worldY);
      assert.ok(state.sideSteps.y < 1.26 - 0.3, 'step must hang clearly below the door sill');
    }
  }
});
