import { DEFAULT_DESIGN, normalizeDesign, sameDesign, type CarDesign } from './customization.ts';

export const STORAGE_KEY = 'little-garage.workshop.v1';
export const MAX_SAVED_CARS = 6;
type LocalStorage = Pick<Storage, 'getItem' | 'setItem'>;
export interface SavedCar { id: string; design: CarDesign }
export interface RemovedCar { car: SavedCar; index: number }

function copyCar(car: SavedCar): SavedCar { return { id: car.id, design: { ...car.design } }; }

export class DesignStore {
  private current: CarDesign = { ...DEFAULT_DESIGN };
  private collection: SavedCar[] = [];
  private storage: LocalStorage | null;
  private durable = false;

  constructor(storage: LocalStorage | null) {
    this.storage = storage;
    if (!storage) return;
    try {
      const raw = storage.getItem(STORAGE_KEY);
      this.durable = true;
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || data.version !== 1) return;
      this.current = normalizeDesign(data.draft);
      const seen = new Set<string>();
      if (Array.isArray(data.cars)) {
        for (const item of data.cars) {
          if (!item || typeof item.id !== 'string' || !item.id || seen.has(item.id)) continue;
          seen.add(item.id);
          this.collection.push({ id: item.id, design: normalizeDesign(item.design) });
          if (this.collection.length === MAX_SAVED_CARS) break;
        }
      }
    } catch {
      // Bad JSON and browsers that refuse storage must still allow play.
      this.durable = false;
    }
  }

  get draft(): CarDesign { return { ...this.current }; }
  get cars(): SavedCar[] { return this.collection.map(copyCar); }
  get persisted(): boolean { return this.durable; }
  get isSaved(): boolean { return this.collection.some((car) => sameDesign(car.design, this.current)); }

  update(design: CarDesign): void {
    this.current = normalizeDesign(design);
    this.write();
  }

  save(): 'saved' | 'existing' | 'full' {
    if (this.isSaved) { this.write(); return 'existing'; }
    if (this.collection.length >= MAX_SAVED_CARS) return 'full';
    this.collection.unshift({ id: crypto.randomUUID(), design: { ...this.current } });
    this.write();
    return 'saved';
  }

  open(id: string): CarDesign | null {
    const car = this.collection.find((item) => item.id === id);
    if (!car) return null;
    this.update(car.design);
    return this.draft;
  }

  remove(id: string): RemovedCar | null {
    const index = this.collection.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const [car] = this.collection.splice(index, 1);
    this.write();
    return { car: copyCar(car), index };
  }

  restore(removed: RemovedCar): boolean {
    if (this.collection.length >= MAX_SAVED_CARS || this.collection.some((item) => item.id === removed.car.id)) return false;
    this.collection.splice(Math.min(removed.index, this.collection.length), 0, copyCar(removed.car));
    this.write();
    return true;
  }

  private write(): void {
    try {
      if (!this.storage) { this.durable = false; return; }
      this.storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, draft: this.current, cars: this.collection }));
      this.durable = true;
    } catch {
      this.durable = false;
    }
  }
}

export function browserDesignStore(): DesignStore {
  try { return new DesignStore(window.localStorage); }
  catch { return new DesignStore(null); }
}
