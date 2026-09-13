import assert from 'node:assert/strict';
import test from 'node:test';
import { ROAD_FLAT, ROAD_LENGTH, ROAD_MAX_HEIGHT, createRoad, roadHeight } from '../src/terrain.ts';
import { TRIP_DISTANCE } from '../src/controller.ts';

test('road height is periodic over one lap and flat near the start so trips begin and end level', () => {
  for (const z of [0, 7.3, 31, 55.5, 90]) {
    assert.ok(Math.abs(roadHeight(z) - roadHeight(z + ROAD_LENGTH)) < 1e-9);
    assert.ok(Math.abs(roadHeight(z, 1.19) - roadHeight(z + 2 * ROAD_LENGTH, 1.19)) < 1e-9);
  }
  assert.equal(roadHeight(0), 0);
  assert.equal(roadHeight(ROAD_LENGTH), 0);
  assert.ok(Math.abs(roadHeight(0.5)) < 0.01);
  assert.ok(Math.abs(roadHeight(ROAD_LENGTH - 0.5)) < 0.01);
});

test('road actually has bumps, keeps them within the limit, and both wheel tracks stay similar', () => {
  let max = 0;
  let min = 0;
  for (let z = 0; z < ROAD_LENGTH; z += 0.1) {
    for (const x of [-1.38, -1.19, 0, 1.19, 1.38]) {
      const h = roadHeight(z, x);
      max = Math.max(max, h);
      min = Math.min(min, h);
      assert.ok(Math.abs(h) <= ROAD_MAX_HEIGHT + 1e-9);
    }
    assert.ok(Math.abs(roadHeight(z, -1.19) - roadHeight(z, 1.19)) < 0.15, 'tracks differ too much at ' + z);
  }
  assert.ok(max > 0.2 && min < -0.2, 'road should rise and fall noticeably: ' + min + '..' + max);
  assert.ok(Math.abs(roadHeight(ROAD_FLAT + 6)) > 0.02 || Math.abs(roadHeight(ROAD_FLAT + 9)) > 0.02);
});

test('a trip drives exactly one lap of road', () => {
  assert.equal(TRIP_DISTANCE, ROAD_LENGTH);
});

test('road mesh scrolls one lap length and wraps', () => {
  const road = createRoad();
  road.setDistance(10);
  const a = road.root.position.z;
  road.setDistance(10 + ROAD_LENGTH);
  assert.ok(Math.abs(road.root.position.z - a) < 1e-9);
  road.setDistance(ROAD_LENGTH / 2);
  assert.ok(Math.abs(road.root.position.z - ROAD_LENGTH / 2) < 1e-9);
  assert.ok(road.root.children.length >= 3);
});
