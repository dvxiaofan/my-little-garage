export type OpenPart = 'doors' | 'hood' | 'trunk';
export type SuspensionPhase = 'idle' | 'pressing' | 'holding' | 'returning';
export type DrivePhase = 'idle' | 'starting' | 'cruising' | 'stopping';

/** One lap of the trail; must match terrain ROAD_LENGTH. */
export const TRIP_DISTANCE = 96;
export const TRIP_SECONDS = 22;
export const TRIP_SECONDS_REDUCED = 8;

export interface CarPose {
  doors: number;
  hood: number;
  trunk: number;
  lights: boolean;
  compression: number;
  /** Distance driven during a trip, in world units; drives wheel rotation. */
  distance: number;
}

export interface CarState {
  doors: boolean;
  hood: boolean;
  trunk: boolean;
  lights: boolean;
  suspension: SuspensionPhase;
  driving: DrivePhase;
}

const smoothstep = (value: number) => value * value * (3 - 2 * value);

/** Owns independent part targets and one finite, repeatable suspension cycle. */
export class CarController {
  readonly pose: CarPose = { doors: 0, hood: 0, trunk: 0, lights: false, compression: 0, distance: 0 };
  private targets = { doors: false, hood: false, trunk: false };
  private suspensionTime: number | null = null;
  private phase: SuspensionPhase = 'idle';
  private tripTime: number | null = null;
  private drivePhase: DrivePhase = 'idle';
  private partsBeforeTrip: { doors: boolean; hood: boolean; trunk: boolean } | null = null;
  private readonly reducedMotion: boolean;

  constructor(reducedMotion = false) {
    this.reducedMotion = reducedMotion;
  }

  toggle(part: OpenPart): boolean {
    this.targets[part] = !this.targets[part];
    return this.targets[part];
  }

  toggleLights(): boolean {
    this.pose.lights = !this.pose.lights;
    return this.pose.lights;
  }

  pressSuspension(): boolean {
    if (this.suspensionTime !== null || this.tripTime !== null) return false;
    this.suspensionTime = 0;
    this.phase = 'pressing';
    return true;
  }

  /** Drive one lap of the trail. Opening parts close for the trip and reopen afterwards. */
  startDrive(): boolean {
    if (this.tripTime !== null || this.suspensionTime !== null) return false;
    this.partsBeforeTrip = { ...this.targets };
    this.targets = { doors: false, hood: false, trunk: false };
    this.tripTime = 0;
    this.drivePhase = 'starting';
    this.pose.distance = 0;
    return true;
  }

  /** 0..1 progress of the current trip, or 0 when not driving. */
  get tripProgress(): number {
    return this.tripTime === null ? 0 : Math.min(this.tripTime / this.tripSeconds, 1);
  }

  private get tripSeconds(): number { return this.reducedMotion ? TRIP_SECONDS_REDUCED : TRIP_SECONDS; }

  reset(): void {
    this.targets = { doors: false, hood: false, trunk: false };
    Object.assign(this.pose, { doors: 0, hood: 0, trunk: 0, lights: false, compression: 0, distance: 0 });
    this.suspensionTime = null;
    this.phase = 'idle';
    this.tripTime = null;
    this.drivePhase = 'idle';
    this.partsBeforeTrip = null;
  }

  update(deltaSeconds: number): void {
    const dt = Math.max(0, Math.min(deltaSeconds, 0.1));
    const blend = 1 - Math.exp(-dt * (this.reducedMotion ? 18 : 7));
    for (const part of ['doors', 'hood', 'trunk'] as const) {
      const target = Number(this.targets[part]);
      this.pose[part] += (target - this.pose[part]) * blend;
      if (Math.abs(target - this.pose[part]) < 0.0002) this.pose[part] = target;
    }

    if (this.tripTime !== null) {
      this.tripTime += dt;
      const total = this.tripSeconds;
      const t = Math.min(this.tripTime / total, 1);
      // Ease in and out so the lap starts gently and rolls to a stop exactly at the flat stretch.
      this.pose.distance = TRIP_DISTANCE * smoothstep(t);
      this.drivePhase = t < 0.18 ? 'starting' : t < 0.82 ? 'cruising' : 'stopping';
      if (t >= 1) this.finishTrip();
      return;
    }

    if (this.suspensionTime === null) return;
    this.suspensionTime += dt;
    const time = this.suspensionTime;

    if (this.reducedMotion) {
      this.phase = time < 0.38 ? 'pressing' : 'returning';
      this.pose.compression = 0.18 * Math.sin(Math.PI * Math.min(time / 0.8, 1)) ** 2;
      if (time >= 0.8) this.finishSuspension();
      return;
    }

    if (time < 0.8) {
      this.phase = 'pressing';
      this.pose.compression = 0.24 * smoothstep(time / 0.8);
    } else if (time < 1.12) {
      this.phase = 'holding';
      this.pose.compression = 0.24;
    } else if (time < 2.9) {
      this.phase = 'returning';
      const release = time - 1.12;
      this.pose.compression = Math.max(-0.055, 0.24 * Math.exp(-3.5 * release) * Math.cos(8 * release));
    } else {
      this.finishSuspension();
    }
  }

  get state(): CarState {
    return { ...this.targets, lights: this.pose.lights, suspension: this.phase, driving: this.drivePhase };
  }

  private finishTrip(): void {
    this.tripTime = null;
    this.drivePhase = 'idle';
    this.pose.distance = TRIP_DISTANCE;
    if (this.partsBeforeTrip) this.targets = this.partsBeforeTrip;
    this.partsBeforeTrip = null;
  }

  private finishSuspension(): void {
    this.suspensionTime = null;
    this.pose.compression = 0;
    this.phase = 'idle';
  }
}
