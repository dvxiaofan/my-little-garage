import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudStore, readBackup } from '../src/cloud-store.ts';
import { DEFAULT_DESIGN } from '../src/customization.ts';
const session = () => ({ profile: { id: 'child-a', name: '小朋友', avatar: '🐻' }, revision: 0, garage: { version: 1 as const, draft: { ...DEFAULT_DESIGN }, cars: [] } });

test('remote saves drain concurrent edits in order and never mark pending changes saved', async t => {
  const writes: any[] = [];
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    writes.push(JSON.parse(options.body as string));
    if (writes.length === 1) await waiting;
    return new Response(JSON.stringify({ revision: writes.length }), { status: 200 });
  });
  const store = new CloudStore(session());
  store.update({ ...DEFAULT_DESIGN, paint: 'blue' });
  const first = store.flush();
  store.update({ ...DEFAULT_DESIGN, paint: 'red' });
  const second = store.flush();
  assert.equal(store.persisted, false);
  release();
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].revision, 1);
  assert.equal(writes[1].garage.draft.paint, 'red');
  assert.equal(store.persisted, true);
});

test('network failure retains current work and supports retry; conflict never blindly overwrites', async t => {
  let status = 503;
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => { requests++; return new Response(JSON.stringify(status === 200 ? { revision: 1 } : { error: 'failed' }), { status }); });
  const store = new CloudStore(session());
  store.update({ ...DEFAULT_DESIGN, paint: 'blue' });
  assert.equal(await store.flush(), false);
  assert.equal(store.state, 'error');
  assert.equal(store.draft.paint, 'blue');
  status = 200;
  assert.equal(await store.flush(), true);
  status = 409;
  store.update({ ...DEFAULT_DESIGN, paint: 'red' });
  assert.equal(await store.flush(), false);
  const before = requests;
  assert.equal(await store.flush(), false);
  assert.equal(requests, before);
  assert.equal(store.state, 'conflict');
});

test('imports preserve the remote draft, deduplicate and reject overflow without partial mutation', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{"revision":1}'));
  const store = new CloudStore(session());
  const legacy = readBackup(JSON.stringify({ version: 1, draft: { ...DEFAULT_DESIGN, name: '旧小车' }, cars: [] }));
  assert.equal(store.importCars(legacy), 1);
  assert.equal(store.importCars(legacy), 0);
  assert.deepEqual(store.draft, DEFAULT_DESIGN);
  const before = store.snapshot();
  const many = { version: 1 as const, draft: DEFAULT_DESIGN, cars: Array.from({ length: 6 }, (_, i) => ({ id: String(i), design: { ...DEFAULT_DESIGN, name: '新车' + i } })) };
  assert.throws(() => store.importCars(many), /超过 6 辆/);
  assert.deepEqual(store.snapshot(), before);
  assert.throws(() => readBackup('{"version":1,"draft":{},"cars":[]}'));
  await store.flush();
});
