export type OpenPart = 'doors' | 'hood' | 'trunk';
export type SuspensionPhase = 'idle' | 'pressing' | 'holding' | 'returning';

export interface CarPose {
  doors: number;
  hood: number;
  trunk: number;
  lights: boolean;
  compression: number;
}

export interface CarState {
  doors: boolean;
  hood: boolean;
  trunk: boolean;
  lights: boolean;
  suspension: SuspensionPhase;
}

const smoothstep = (value: number) => value * value * (3 - 2 * value);

/** Owns independent part targets and one finite, repeatable suspension cycle. */
export class CarController {
  readonly pose: CarPose = { doors: 0, hood: 0, trunk: 0, lights: false, compression: 0 };
  private targets = { doors: false, hood: false, trunk: false };
  private suspensionTime: number | null = null;
  private phase: SuspensionPhase = 'idle';
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
    if (this.suspensionTime !== null) return false;
    this.suspensionTime = 0;
    this.phase = 'pressing';
    return true;
  }

  reset(): void {
    this.targets = { doors: false, hood: false, trunk: false };
    Object.assign(this.pose, { doors: 0, hood: 0, trunk: 0, lights: false, compression: 0 });
    this.suspensionTime = null;
    this.phase = 'idle';
  }

  update(deltaSeconds: number): void {
    const dt = Math.max(0, Math.min(deltaSeconds, 0.1));
    const blend = 1 - Math.exp(-dt * (this.reducedMotion ? 18 : 7));
    for (const part of ['doors', 'hood', 'trunk'] as const) {
      const target = Number(this.targets[part]);
      this.pose[part] += (target - this.pose[part]) * blend;
      if (Math.abs(target - this.pose[part]) < 0.0002) this.pose[part] = target;
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
    return { ...this.targets, lights: this.pose.lights, suspension: this.phase };
  }

  private finishSuspension(): void {
    this.suspensionTime = null;
    this.pose.compression = 0;
    this.phase = 'idle';
  }
}
