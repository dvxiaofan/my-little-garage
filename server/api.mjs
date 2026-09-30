import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DEFAULT_DESIGN, normalizeDesign } from '../src/customization.ts';
import { isAvatar } from '../src/profiles.ts';

const scrypt = promisify(scryptCallback);
const digest = value => createHash('sha256').update(value).digest('hex');
const duration = 12 * 60 * 60 * 1000;
const windowMs = 10 * 60 * 1000;
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
const emptyGarage = () => ({ version: 1, draft: { ...DEFAULT_DESIGN }, cars: [] });

function validateDesign(value) {
  if (!value || typeof value !== 'object') fail(400, '小车数据不完整');
  const normalized = normalizeDesign(value);
  if (Object.keys(normalized).some(key => value[key] !== normalized[key])) fail(400, '小车数据格式不正确');
  return normalized;
}
export function validateGarage(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.cars) || value.cars.length > 6) fail(400, '车库最多保存 6 辆小车');
  const ids = new Set();
  const cars = value.cars.map(car => {
    if (!car || typeof car.id !== 'string' || !/^[\w-]{1,80}$/.test(car.id) || ids.has(car.id)) fail(400, '小车编号不正确');
    ids.add(car.id);
    return { id: car.id, design: validateDesign(car.design) };
  });
  return { version: 1, draft: validateDesign(value.draft), cars };
}
async function body(req) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 32768) fail(413, '提交内容太大了');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { fail(400, '请求格式不正确'); }
}
function pinValid(pin) { if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) fail(400, '请输入 4 位数字口令'); }
export function createApi({ database = process.env.GARAGE_DB || resolve('data/garage.sqlite'), secureCookie = process.env.GARAGE_SECURE_COOKIE === '1', now = Date.now } = {}) {
  if (database !== ':memory:') mkdirSync(dirname(database), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(database);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS garages (user_id TEXT PRIMARY KEY REFERENCES profiles(id), revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES profiles(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);`);
  const publicProfile = row => ({ id: row.id, name: row.name, avatar: row.avatar });
  function limit(key, maximum, consume = true) {
    const stamp = now();
    db.prepare('DELETE FROM attempts WHERE until <= ?').run(stamp);
    const row = db.prepare('SELECT * FROM attempts WHERE key = ?').get(key);
    if (row && row.count >= maximum) fail(429, '尝试太多，请 10 分钟后再试，或请家长重置口令');
    if (consume) db.prepare('INSERT INTO attempts VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key, stamp + windowMs);
  }
  function session(req) {
    const token = /(?:^|;\s*)garage_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    if (!token) fail(401, '请重新输入口令进入车库');
    const row = db.prepare('SELECT p.* FROM sessions s JOIN profiles p ON p.id=s.user_id WHERE s.token=? AND s.expires>?').get(digest(token), now());
    if (!row) fail(401, '请重新输入口令进入车库');
    if (req.headers['x-garage-user'] && req.headers['x-garage-user'] !== row.id) fail(401, '小朋友已切换，请重新进入车库');
    return row;
  }
  function issue(res, userId) {
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires <= ?').run(now());
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(digest(token), userId, now() + duration);
    res.setHeader('Set-Cookie', `garage_session=${token}; HttpOnly; SameSite=Strict; Path=/api${secureCookie ? '; Secure' : ''}`);
  }
  function garage(id) {
    const row = db.prepare('SELECT revision, data FROM garages WHERE user_id=?').get(id);
    return { revision: row.revision, garage: JSON.parse(row.data) };
  }
  async function resetPin(id, pin) {
    pinValid(pin);
    if (!db.prepare('SELECT id FROM profiles WHERE id=?').get(id)) fail(404, '没有这个小朋友');
    const salt = randomBytes(16).toString('hex');
    const hash = (await scrypt(pin, salt, 64)).toString('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE profiles SET salt=?, hash=? WHERE id=?').run(salt, hash, id);
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
      db.prepare('DELETE FROM attempts WHERE key=?').run('user:' + id);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  async function handle(req, res) {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (!path.startsWith('/api/')) return false;
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(data));
    };
    try {
      if (!['GET', 'HEAD'].includes(req.method)) {
        if (req.headers['x-garage-request'] !== '1') fail(403, '请从小车库页面操作');
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) fail(403, '请求来源不正确');
      }
      const ip = req.socket.remoteAddress || 'unknown';
      if (path === '/api/profiles' && req.method === 'GET') {
        send(200, { profiles: db.prepare('SELECT id, name, avatar FROM profiles ORDER BY rowid').all() });
      } else if (path === '/api/profiles' && req.method === 'POST') {
        limit('create:' + ip, 10);
        const value = await body(req);
        const name = typeof value?.name === 'string' ? value.name.trim() : '';
        if (!name || Array.from(name).length > 12 || /[\u0000-\u001f\u007f]/.test(name)) fail(400, '名字请填写 1 到 12 个字');
        if (!isAvatar(value.avatar)) fail(400, '请选择一个头像');
        pinValid(value.pin);
        const id = randomUUID();
        const salt = randomBytes(16).toString('hex');
        const hash = (await scrypt(value.pin, salt, 64)).toString('hex');
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('INSERT INTO profiles VALUES (?, ?, ?, ?, ?)').run(id, name, value.avatar, salt, hash);
          db.prepare('INSERT INTO garages VALUES (?, 0, ?)').run(id, JSON.stringify(emptyGarage()));
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
        issue(res, id);
        send(201, { profile: { id, name, avatar: value.avatar }, ...garage(id) });
      } else if (path === '/api/login' && req.method === 'POST') {
        const value = await body(req);
        pinValid(value?.pin);
        if (typeof value.id !== 'string' || value.id.length > 80) fail(400, '请选择小朋友');
        limit('ip:' + ip, 30);
        limit('user:' + value.id, 5);
        const row = db.prepare('SELECT * FROM profiles WHERE id=?').get(value.id);
        const result = await scrypt(value.pin, row?.salt || 'unknown', 64);
        if (!row || !timingSafeEqual(Buffer.from(row.hash, 'hex'), result)) fail(401, '口令不对，再试一次');
        // A reset performed while scrypt was running invalidates the old credential.
        if (db.prepare('SELECT hash FROM profiles WHERE id=?').get(row.id)?.hash !== row.hash) fail(401, '口令已更改，请重新输入');
        db.prepare('DELETE FROM attempts WHERE key=?').run('user:' + row.id);
        db.prepare('UPDATE attempts SET count=MAX(0, count-1) WHERE key=?').run('ip:' + ip);
        issue(res, row.id);
        send(200, { profile: publicProfile(row), ...garage(row.id) });
      } else if (path === '/api/session' && req.method === 'GET') {
        const user = session(req);
        send(200, { profile: publicProfile(user), ...garage(user.id) });
      } else if (path === '/api/logout' && req.method === 'POST') {
        const token = /garage_session=([a-f0-9]{64})/.exec(req.headers.cookie || '')?.[1];
        if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));
        res.setHeader('Set-Cookie', `garage_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${secureCookie ? '; Secure' : ''}`);
        send(200, { ok: true });
      } else if (path === '/api/garage' && req.method === 'GET') {
        send(200, garage(session(req).id));
      } else if (path === '/api/garage' && req.method === 'PUT') {
        const user = session(req);
        const value = await body(req);
        if (!Number.isSafeInteger(value?.revision) || value.revision < 0) fail(400, '车库版本不正确');
        const data = validateGarage(value.garage);
        // Recheck identity after reading the request, then atomically compare and advance revision.
        session(req);
        const result = db.prepare('UPDATE garages SET data=?, revision=revision+1 WHERE user_id=? AND revision=?').run(JSON.stringify(data), user.id, value.revision);
        if (!result.changes) fail(409, '另一台设备更新了车库，请先保留本次作品，再读取最新车库');
        send(200, { revision: value.revision + 1 });
      } else send(404, { error: '没有这个接口' });
    } catch (error) {
      if (!(error instanceof HttpError)) console.error('Garage API error:', error.message);
      send(error.status || 500, { error: error.status ? error.message : '服务暂时出错，请稍后重试' });
    }
    return true;
  }
  return { handle, close: () => db.close(), resetPin, list: () => db.prepare('SELECT id, name, avatar FROM profiles ORDER BY rowid').all() };
}
