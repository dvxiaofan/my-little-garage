import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_DESIGN, normalizeDesign } from '../src/customization.ts';
import { DesignStore, MAX_SAVED_CARS, STORAGE_KEY } from '../src/design-store.ts';

function memoryStorage(initial?: string) {
  const values = new Map(initial ? [[STORAGE_KEY, initial]] : []);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

test('draft and separate creations survive a fresh store without later edits overwriting a saved car', () => {
  const storage = memoryStorage();
  const store = new DesignStore(storage);
  const blue = { ...DEFAULT_DESIGN, name: '蓝天露营家', paint: 'blue' as const, roof: 'tent' as const };
  store.update(blue);
  assert.equal(store.save(), 'saved');
  const firstId = store.cars[0].id;
  const green = { ...blue, paint: 'green' as const, name: '森林小勇士', height: 'high' as const };
  store.update(green);
  store.save();
  const reloaded = new DesignStore(storage);
  assert.deepEqual(reloaded.draft, green);
  assert.deepEqual(reloaded.open(firstId), blue);
  assert.equal(reloaded.cars.length, 2);
  reloaded.update({ ...DEFAULT_DESIGN });
  assert.equal(new DesignStore(storage).cars.length, 2);
  const copy = reloaded.cars;
  copy[0].design.name = 'outside edit';
  assert.equal(reloaded.cars[0].design.name, green.name);
});

test('saving the same creation twice is idempotent, while a changed name or configuration is a new creation', () => {
  const store = new DesignStore(memoryStorage());
  assert.equal(store.save(), 'saved');
  const id = store.cars[0].id;
  assert.equal(store.save(), 'existing');
  assert.equal(store.cars.length, 1);
  assert.equal(store.cars[0].id, id);
  store.update({ ...store.draft, wheels: 'crawler' });
  assert.equal(store.isSaved, false);
  assert.equal(store.save(), 'saved');
  assert.equal(store.cars[1].design.wheels, 'trail');
});

test('full collections preserve every car; removal can be undone in its original position', () => {
  const storage = memoryStorage();
  const store = new DesignStore(storage);
  for (let i = 0; i < MAX_SAVED_CARS; i++) {
    store.update({ ...DEFAULT_DESIGN, name: '小车' + i });
    store.save();
  }
  const before = store.cars;
  store.update({ ...DEFAULT_DESIGN, name: '还没存的小车' });
  assert.equal(store.save(), 'full');
  assert.deepEqual(store.cars, before);
  const removed = store.remove(before[2].id)!;
  assert.equal(store.cars.length, MAX_SAVED_CARS - 1);
  assert.equal(store.restore(removed), true);
  assert.deepEqual(store.cars, before);
  assert.equal(store.restore(removed), false);
  assert.deepEqual(new DesignStore(storage).cars, before);
  assert.equal(store.remove('missing'), null);
});

test('unavailable or exhausted storage keeps play usable without reporting durable saves', () => {
  const store = new DesignStore({
    getItem: () => { throw new Error('storage disabled'); },
    setItem: () => { throw new Error('quota exceeded'); },
  });
  assert.deepEqual(store.draft, DEFAULT_DESIGN);
  store.update({ ...DEFAULT_DESIGN, paint: 'green' });
  assert.equal(store.save(), 'saved');
  assert.equal(store.cars.length, 1);
  assert.equal(store.persisted, false);
  assert.equal(store.isSaved, true);
  const noStorage = new DesignStore(null);
  noStorage.update(store.draft);
  noStorage.save();
  assert.equal(noStorage.persisted, false);
});

test('malformed JSON and unknown versions fall back safely; valid fields survive partial invalid data', () => {
  for (const raw of ['{broken', 'null', '{"version":99,"draft":{"paint":"blue"}}']) {
    const store = new DesignStore(memoryStorage(raw));
    assert.deepEqual(store.draft, DEFAULT_DESIGN);
    assert.deepEqual(store.cars, []);
  }
  const store = new DesignStore(memoryStorage(JSON.stringify({
    version: 1,
    draft: { name: '  小车\n  ', paint: 'blue', wheels: 'not-a-wheel', height: 100, roof: null },
    cars: [null, { id: 5 }, { id: 'one', design: { paint: 'red' } }, { id: 'one', design: {} }],
  })));
  assert.deepEqual(store.draft, { ...DEFAULT_DESIGN, name: '小车', paint: 'blue' });
  assert.equal(store.cars.length, 1);
  assert.deepEqual(store.cars[0].design, { ...DEFAULT_DESIGN, paint: 'red' });
  assert.equal(normalizeDesign({ name: 'abcdefghijklmnop' }).name, 'abcdefghijkl');
});
