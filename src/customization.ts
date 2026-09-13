export const PAINTS = [
  { id: 'orange', label: '大地金', color: '#cd9d46' },
  { id: 'blue', label: '天空蓝', color: '#6196ba' },
  { id: 'green', label: '森林绿', color: '#6b9271' },
  { id: 'red', label: '番茄红', color: '#c8594a' },
  { id: 'yellow', label: '太阳黄', color: '#e8c04a' },
] as const;

export const WHEELS = [
  { id: 'road', label: '公路轮', radius: 0.52, track: 1.12, width: 0.94 },
  { id: 'trail', label: '越野轮', radius: 0.60, track: 1.12, width: 1 },
  { id: 'crawler', label: '大脚轮', radius: 0.72, track: 1.30, width: 1.1 },
] as const;

export const HEIGHTS = [
  { id: 'normal', label: '原来高', lift: 0 },
  { id: 'raised', label: '高一点', lift: 0.18 },
  { id: 'high', label: '再高点', lift: 0.34 },
] as const;

export const ROOFS = [
  { id: 'none', label: '不装', extraHeight: 0 },
  { id: 'cargo', label: '行李箱', extraHeight: 0.34 },
  { id: 'tent', label: '小帐篷', extraHeight: 0.69 },
] as const;

export type PaintId = typeof PAINTS[number]['id'];
export type WheelId = typeof WHEELS[number]['id'];
export type HeightId = typeof HEIGHTS[number]['id'];
export type RoofId = typeof ROOFS[number]['id'];
export type DesignPart = 'paint' | 'wheels' | 'height' | 'roof';

export interface CarDesign {
  name: string;
  paint: PaintId;
  wheels: WheelId;
  height: HeightId;
  roof: RoofId;
}

export const DEFAULT_DESIGN: Readonly<CarDesign> = {
  name: '越野小勇士', paint: 'orange', wheels: 'trail', height: 'normal', roof: 'none',
};

export function normalizeName(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_DESIGN.name;
  return Array.from(value.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, 12).join('') || DEFAULT_DESIGN.name;
}

function validId<T extends string>(options: readonly { id: T }[], value: unknown, fallback: T): T {
  return options.find((option) => option.id === value)?.id ?? fallback;
}

/** Storage is optional and may contain old or incomplete data. Only known choices enter the model. */
export function normalizeDesign(value: unknown): CarDesign {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    name: normalizeName(source.name),
    paint: validId(PAINTS, source.paint, DEFAULT_DESIGN.paint),
    wheels: validId(WHEELS, source.wheels, DEFAULT_DESIGN.wheels),
    height: validId(HEIGHTS, source.height, DEFAULT_DESIGN.height),
    roof: validId(ROOFS, source.roof, DEFAULT_DESIGN.roof),
  };
}

export function designMeasurements(design: CarDesign) {
  const wheel = WHEELS.find((item) => item.id === design.wheels)!;
  const lift = HEIGHTS.find((item) => item.id === design.height)!.lift;
  const roof = ROOFS.find((item) => item.id === design.roof)!;
  return { wheel, lift, extraHeight: wheel.radius - 0.60 + lift + roof.extraHeight };
}

export function sameDesign(a: CarDesign, b: CarDesign): boolean {
  return a.name === b.name && a.paint === b.paint && a.wheels === b.wheels && a.height === b.height && a.roof === b.roof;
}

export function suggestName(design: CarDesign, turn: number): string {
  const colors: Record<PaintId, string> = { orange: '金沙', blue: '蓝天', green: '森林', red: '红豆', yellow: '太阳' };
  const endings = design.roof === 'tent' ? ['露营家', '旅行家', '探险号']
    : design.wheels === 'crawler' ? ['大脚怪', '登山家', '小巨人'] : ['小勇士', '探险家', '小闪电'];
  return colors[design.paint] + endings[turn % endings.length];
}
