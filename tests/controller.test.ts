import assert from 'node:assert/strict';
import test from 'node:test';
import { CarController } from '../src/controller.ts';

function advance(controller: CarController, seconds: number): void {
  for (let frame = 0; frame < seconds * 60; frame++) controller.update(1 / 60);
}

test('opening one part does not change the other opening targets or lights', () => {
  const car = new CarController();
  car.toggle('doors');
  advance(car, 1.5);
  assert.equal(car.state.doors, true);
  assert.ok(car.pose.doors > 0.999);
  assert.equal(car.pose.hood, 0);
  assert.equal(car.pose.trunk, 0);
  assert.equal(car.pose.lights, false);
});

test('reversing a part mid-animation finishes at the last requested state', () => {
  const car = new CarController();
  car.toggle('hood');
  advance(car, 0.12);
  assert.ok(car.pose.hood > 0 && car.pose.hood < 1);
  car.toggle('hood');
  advance(car, 1.7);
  assert.equal(car.pose.hood, 0);
  assert.equal(car.state.hood, false);
});

test('a suspension cycle cannot stack, preserves opened parts, and becomes repeatable', () => {
  const car = new CarController();
  car.toggle('doors');
  car.toggle('hood');
  car.toggle('trunk');
  car.toggleLights();
  assert.equal(car.pressSuspension(), true);
  advance(car, 0.9);
  assert.ok(car.pose.compression > 0.2);
  assert.equal(car.pressSuspension(), false);
  advance(car, 2.3);
  assert.equal(car.pose.compression, 0);
  assert.deepEqual(car.state, { doors: true, hood: true, trunk: true, lights: true, suspension: 'idle' });
  assert.equal(car.pressSuspension(), true);
});

test('reset during compression cancels the cycle and does not resume on later frames', () => {
  const car = new CarController();
  car.toggle('trunk');
  car.toggleLights();
  car.pressSuspension();
  advance(car, 0.9);
  car.reset();
  advance(car, 4);
  assert.deepEqual(car.pose, { doors: 0, hood: 0, trunk: 0, lights: false, compression: 0 });
  assert.equal(car.state.suspension, 'idle');
});

test('reduced-motion mode still shows and completes the suspension cycle', () => {
  const car = new CarController(true);
  car.pressSuspension();
  advance(car, 0.3);
  assert.ok(car.pose.compression > 0.1);
  advance(car, 0.6);
  assert.equal(car.pose.compression, 0);
  assert.equal(car.state.suspension, 'idle');
});
