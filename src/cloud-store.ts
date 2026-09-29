import { DesignStore, carId, MAX_SAVED_CARS, type GarageData } from './design-store.ts';
import { DEFAULT_DESIGN, sameDesign, type CarDesign } from './customization.ts';
import type { Profile } from './profiles.ts';

export interface FamilySession { profile: Profile; revision: number; garage: GarageData }
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export async function api<T>(path: string, method = 'GET', data?: unknown, user?: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('/api/' + path, {
      method, signal: controller.signal, credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Garage-Request': '1', ...(user ? { 'X-Garage-User': user } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const value = await response.json();
    if (!response.ok) throw new ApiError(response.status, value.error || '操作没有完成');
    return value as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, '暂时连不上家庭车库，请检查网络后重试');
  } finally { clearTimeout(timeout); }
}
export type SaveState = 'saved' | 'saving' | 'error' | 'conflict' | 'expired';
export const SAVE_LABELS: Record<SaveState, string> = {
  saved: '已保存到家庭车库', saving: '正在保存…', error: '尚未保存，请重试',
  conflict: '另一台设备更新了车库', expired: '登录已失效，请重新进入',
};

export class CloudStore extends DesignStore {
  state: SaveState = 'saved';
  private revision: number;
  private dirty = false;
  private flight: Promise<boolean> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  readonly profile: Profile;

  constructor(session: FamilySession) {
    let changed = () => {};
    super({ getItem: () => JSON.stringify(session.garage), setItem: () => changed() });
    this.revision = session.revision;
    this.profile = session.profile;
    changed = () => this.schedule();
  }
  override get persisted(): boolean { return this.state === 'saved'; }
  get label(): string { return SAVE_LABELS[this.state]; }
  get hasPending(): boolean { return this.dirty || this.flight !== null; }
  subscribe(fn: () => void): void { this.listeners.add(fn); }
  private notify(): void { for (const fn of this.listeners) fn(); }
  private schedule(): void {
    this.dirty = true;
    if (this.state !== 'conflict' && this.state !== 'expired') {
      this.state = 'saving';
      clearTimeout(this.timer);
      this.timer = setTimeout(() => { void this.flush(); }, 350);
    }
    // Let the synchronous workshop action finish updating its input first.
    queueMicrotask(() => this.notify());
  }
  async flush(): Promise<boolean> {
    clearTimeout(this.timer);
    if (this.flight) return this.flight;
    if (!this.dirty) return true;
    if (this.state === 'conflict' || this.state === 'expired') return false;
    this.flight = (async () => {
      do { await this.send(); } while (this.dirty && this.state === 'saving');
      return !this.dirty;
    })();
    try { return await this.flight; } finally { this.flight = null; }
  }
  private async send(): Promise<void> {
    const garage = this.snapshot();
    this.dirty = false;
    this.state = 'saving';
    this.notify();
    try {
      const result = await api<{ revision: number }>('garage', 'PUT', { revision: this.revision, garage }, this.profile.id);
      this.revision = result.revision;
      this.state = this.dirty ? 'saving' : 'saved';
    } catch (error) {
      this.dirty = true;
      const status = (error as ApiError).status;
      this.state = status === 409 ? 'conflict' : status === 401 ? 'expired' : 'error';
    }
    this.notify();
  }
  async reload(): Promise<void> {
    if (this.flight) await this.flight;
    clearTimeout(this.timer);
    const result = await api<{ revision: number; garage: GarageData }>('garage', 'GET', undefined, this.profile.id);
    this.replace(result.garage, false);
    this.revision = result.revision;
    this.dirty = false;
    this.state = 'saved';
    this.notify();
  }
  importCars(data: GarageData): number {
    const additions = data.cars.map(car => car.design);
    if (!sameDesign(data.draft, DEFAULT_DESIGN)) additions.push(data.draft);
    const cars = this.cars;
    let count = 0;
    for (const design of additions) {
      if (cars.some(car => sameDesign(car.design, design))) continue;
      cars.push({ id: carId(), design: { ...design } });
      count++;
    }
    if (cars.length > MAX_SAVED_CARS) throw new Error('合起来超过 6 辆了。请先移走一些作品，再导入；这次没有修改车库。');
    if (count) this.replace({ version: 1, draft: this.draft, cars });
    return count;
  }
}

/** Parse imports strictly before presenting a confirmation; do not silently turn bad data into defaults. */
export function readBackup(raw: string): GarageData {
  if (raw.length > 32768) throw new Error('文件太大，请选择小车库导出的备份');
  const value = JSON.parse(raw);
  const data = value.garage || value;
  const validDesign = (design: CarDesign) => {
    if (!design || typeof design.name !== 'string' || !design.name.trim()) return false;
    const normalized = new DesignStore({ getItem: () => JSON.stringify({ version: 1, draft: design, cars: [] }), setItem() {} }).draft;
    return Object.keys(normalized).every(key => normalized[key as keyof CarDesign] === design[key as keyof CarDesign]);
  };
  if (data.version !== 1 || !validDesign(data.draft) || !Array.isArray(data.cars) || data.cars.length > 6 || data.cars.some((car: { design: CarDesign }) => !car || !validDesign(car.design))) throw new Error('这不是有效的小车库备份');
  return { version: 1, draft: data.draft, cars: data.cars.map((car: { design: CarDesign }) => ({ id: carId(), design: car.design })) };
}
