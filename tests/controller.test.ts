import assert from 'node:assert/strict';
import test from 'node:test';
import { CarController, TRIP_DISTANCE } from '../src/controller.ts';

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
  assert.deepEqual(car.state, { doors: true, hood: true, trunk: true, lights: true, suspension: 'idle', driving: 'idle' });
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
  assert.deepEqual(car.pose, { doors: 0, hood: 0, trunk: 0, lights: false, compression: 0, distance: 0 });
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

test('a trip closes opened parts, drives exactly one lap, cannot stack or overlap the suspension, and reopens parts afterwards', () => {
  const car = new CarController();
  car.toggle('doors');
  car.toggle('trunk');
  car.toggleLights();
  advance(car, 1.5);
  assert.equal(car.startDrive(), true);
  assert.equal(car.startDrive(), false);
  assert.equal(car.pressSuspension(), false);
  assert.equal(car.state.doors, false);
  assert.equal(car.state.trunk, false);
  assert.equal(car.state.lights, true);
  advance(car, 1);
  assert.equal(car.state.driving, 'starting');
  assert.ok(car.pose.distance > 0 && car.pose.distance < TRIP_DISTANCE / 4);
  assert.ok(car.pose.doors < 0.01, 'doors should have closed for the trip');
  advance(car, 10);
  assert.equal(car.state.driving, 'cruising');
  const midway = car.pose.distance;
  advance(car, 1 / 60);
  assert.ok(car.pose.distance > midway, 'distance keeps increasing');
  advance(car, 12);
  assert.equal(car.state.driving, 'idle');
  assert.equal(car.pose.distance, TRIP_DISTANCE);
  assert.equal(car.tripProgress, 0);
  assert.equal(car.state.doors, true);
  assert.equal(car.state.trunk, true);
  assert.equal(car.state.hood, false);
  assert.equal(car.state.lights, true);
  assert.equal(car.pressSuspension(), true);
});

test('reset during a trip stops it, and reduced motion completes a shorter lap', () => {
  const car = new CarController();
  car.toggle('hood');
  car.startDrive();
  advance(car, 5);
  car.reset();
  advance(car, 30);
  assert.equal(car.state.driving, 'idle');
  assert.equal(car.pose.distance, 0);
  assert.equal(car.state.hood, false);

  const calm = new CarController(true);
  calm.startDrive();
  advance(calm, 4);
  assert.ok(calm.pose.distance > 10);
  advance(calm, 5);
  assert.equal(calm.state.driving, 'idle');
  assert.equal(calm.pose.distance, TRIP_DISTANCE);
});
