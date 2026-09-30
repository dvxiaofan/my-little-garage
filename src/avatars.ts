import { AVATARS, avatarFor } from './profiles.ts';

type Shape = typeof AVATARS[number]['shape'];
const SHAPES: Record<Shape, { body: string; windows: string; trim: string; wheels?: [number, number] }> = {
  sports: {
    body: 'M8 47 16 40 32 36 44 25Q47 23 53 25L66 29 77 39 87 43Q90 44 90 49V54H8Z',
    windows: 'M39 36 47 28 61 31 68 37Z',
    trim: '<path d="m12 44 12-2m52 4h10M43 42h17"/><path d="M11 36h14v5"/>',
  },
  sedan: {
    body: 'M8 44 23 39 34 25Q36 23 41 23H59Q62 23 65 27L76 39 85 42Q90 44 90 49V54H8Z',
    windows: 'M29 38 38 28H47V38ZM52 28H59L68 38H52Z',
    trim: '<path d="M48 41v11m8-9h6M12 46h7m61 0h7"/>',
  },
  suv: {
    body: 'M8 29Q8 23 14 23H63Q66 23 68 27L76 37H86Q90 37 90 43V55H8Z',
    windows: 'M15 29H32V38H15ZM38 29H53V38H38ZM59 29H64L70 38H59Z',
    trim: '<path d="M13 20h48M36 41v13m19-13v13m-12-9h5"/><path d="M7 46h9m64-2h10" stroke-width="4"/>',
  },
  pickup: {
    body: 'M8 36H44V25Q44 22 48 22H65L77 37H85Q90 37 90 43V54H8Z',
    windows: 'M50 28H62L69 38H50Z',
    trim: '<path d="M12 34h28m4 5v14m9-8h7M12 43h22m47 0h6"/>',
  },
  bus: {
    body: 'M10 22Q10 15 17 15H76Q86 15 86 25V55H10Z',
    windows: 'M16 22H28V34H16ZM33 22H45V34H33ZM50 22H62V34H50ZM68 22H79V37H68Z',
    trim: '<path d="M14 40h47m5-2v16M14 45h12m52-1h7"/><path d="M17 18h55" stroke="#fff" opacity=".5"/>',
  },
  mini: {
    body: 'M17 41 24 25Q27 20 33 20H59Q66 20 69 27L76 41 82 45V55H14V47Z',
    windows: 'M27 36 32 26H44V36ZM49 26H58Q62 26 64 31L67 36H49Z',
    trim: '<path d="M46 39v14m5-9h6M17 45h7m49 0h7"/>',
    wheels: [29, 67],
  },
};

export function carAvatarSvg(value: unknown): string {
  const avatar = avatarFor(value);
  const shape = SHAPES[avatar.shape];
  const wheels = (shape.wheels ?? [25, 73]).map(x => '<circle cx="' + x + '" cy="54" r="9" fill="#344337"/><circle cx="' + x + '" cy="54" r="4" fill="#faf5df" stroke="none"/>').join('');
  return '<svg class="car-avatar" data-avatar="' + avatar.id + '" viewBox="0 0 96 72" aria-hidden="true" focusable="false"><ellipse cx="48" cy="65" rx="39" ry="3" fill="#344337" opacity=".1"/><g stroke="#43513e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="car-body" d="' + shape.body + '" fill="' + avatar.color + '"/><path d="' + shape.windows + '" fill="#f5f1d8" stroke-width="1.5"/><g fill="none" opacity=".6">' + shape.trim + '</g>' + wheels + '</g></svg>';
}

export function avatarElement(value: unknown): HTMLSpanElement {
  const span = document.createElement('span'); span.className = 'avatar-icon';
  // Only locally defined shapes and colors reach this markup, never the supplied value.
  span.innerHTML = carAvatarSvg(value);
  return span;
}
