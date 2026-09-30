import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from './api.mjs';

async function fixture(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'family-garage-'));
  const database = join(dir, 'test.sqlite');
  let api = createApi({ database, ...options });
  const server = createServer((req, res) => api.handle(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); api.close(); await rm(dir, { recursive: true, force: true }); });
  const request = async (path, method = 'GET', data, cookie = '', headers = {}) => {
    const response = await fetch(base + '/api/' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Garage-Request': '1', cookie, ...headers }, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
  };
  return { request, reset: (...args) => api.resetPin(...args), restart: () => { api.close(); api = createApi({ database, ...options }); } };
}
const newUser = { name: '小车迷', avatar: '🐻', pin: '2468' };

test('profiles isolate garage data; revisions prevent overwrites; database and sessions survive restart', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('garage')).status, 401);
  const a = await f.request('profiles', 'POST', newUser);
  const b = await f.request('profiles', 'POST', newUser);
  assert.equal(a.status, 201);
  assert.notEqual(a.data.profile.id, b.data.profile.id);
  const list = await f.request('profiles');
  assert.equal(list.data.profiles.length, 2);
  assert.deepEqual(Object.keys(list.data.profiles[0]).sort(), ['avatar', 'id', 'name']);
  const garage = a.data.garage;
  garage.draft.name = '我的第一辆';
  garage.cars.push({ id: 'one', design: { ...garage.draft } });
  const save = await f.request('garage', 'PUT', { revision: 0, garage }, a.cookie, { 'X-Garage-User': a.data.profile.id });
  assert.equal(save.status, 200);
  assert.equal(save.data.revision, 1);
  assert.equal((await f.request('garage', 'PUT', { revision: 0, garage }, a.cookie)).status, 409);
  assert.equal((await f.request('garage', 'GET', undefined, b.cookie)).data.garage.cars.length, 0);
  assert.equal((await f.request('garage', 'PUT', { revision: 1, garage }, b.cookie, { 'X-Garage-User': a.data.profile.id })).status, 401);
  f.restart();
  const again = await f.request('login', 'POST', { id: a.data.profile.id, pin: '2468' });
  assert.equal(again.data.garage.cars[0].design.name, '我的第一辆');
  assert.equal((await f.request('session', 'GET', undefined, a.cookie)).status, 200);
  assert.equal((await f.request('logout', 'POST', {}, a.cookie)).status, 200);
  assert.equal((await f.request('garage', 'GET', undefined, a.cookie)).status, 401);
});

test('bad PINs never create accounts; persistent lockout and parent reset revoke sessions', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('profiles', 'POST', { ...newUser, pin: '12ab' })).status, 400);
  const a = await f.request('profiles', 'POST', newUser);
  for (let i = 0; i < 5; i++) assert.equal((await f.request('login', 'POST', { id: a.data.profile.id, pin: '0000' })).status, 401);
  f.restart();
  assert.equal((await f.request('login', 'POST', { id: a.data.profile.id, pin: '2468' })).status, 429);
  assert.equal((await f.request('profiles')).data.profiles.length, 1);
  await f.reset(a.data.profile.id, '1357');
  assert.equal((await f.request('session', 'GET', undefined, a.cookie)).status, 401);
  assert.equal((await f.request('login', 'POST', { id: a.data.profile.id, pin: '1357' })).status, 200);
});

test('expired sessions, cross-origin writes, invalid and oversized garages are rejected', async t => {
  let stamp = Date.now();
  const f = await fixture(t, { now: () => stamp });
  const a = await f.request('profiles', 'POST', newUser);
  assert.equal((await f.request('profiles', 'POST', newUser, '', { Origin: 'http://other.example' })).status, 403);
  assert.equal((await f.request('profiles', 'POST', newUser, '', { 'X-Garage-Request': '' })).status, 403);
  const garage = structuredClone(a.data.garage);
  garage.cars = Array.from({ length: 7 }, (_, i) => ({ id: String(i), design: garage.draft }));
  assert.equal((await f.request('garage', 'PUT', { revision: 0, garage }, a.cookie)).status, 400);
  assert.equal((await f.request('garage', 'PUT', { revision: 0, text: 'x'.repeat(40000) }, a.cookie)).status, 413);
  stamp += 13 * 60 * 60 * 1000;
  assert.equal((await f.request('session', 'GET', undefined, a.cookie)).status, 401);
});

test('car avatars accept all six designs while legacy profiles remain usable', async t => {
  const f = await fixture(t);
  for (const avatar of ['car-red-sports', 'car-blue-sedan', 'car-green-suv', 'car-orange-pickup', 'car-yellow-bus', 'car-purple-mini']) {
    const created = await f.request('profiles', 'POST', { ...newUser, avatar });
    assert.equal(created.status, 201, avatar);
    assert.equal(created.data.profile.avatar, avatar);
  }
  const legacy = await f.request('profiles', 'POST', newUser);
  assert.equal(legacy.status, 201);
  f.restart();
  const login = await f.request('login', 'POST', { id: legacy.data.profile.id, pin: newUser.pin });
  assert.equal(login.status, 200);
  assert.equal(login.data.profile.avatar, '🐻');
  for (const avatar of ['car-unknown', '<svg onload=alert(1)>']) {
    assert.equal((await f.request('profiles', 'POST', { ...newUser, avatar })).status, 400);
  }
});
