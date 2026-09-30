export const AVATARS = [
  { id: 'car-red-sports', name: '红色跑车', shape: 'sports', color: '#dc6553', legacy: '🐰' },
  { id: 'car-blue-sedan', name: '蓝色轿车', shape: 'sedan', color: '#6098ba', legacy: '🐼' },
  { id: 'car-green-suv', name: '绿色越野车', shape: 'suv', color: '#819e61', legacy: '🐻' },
  { id: 'car-orange-pickup', name: '橙色皮卡', shape: 'pickup', color: '#e49a50', legacy: '🦊' },
  { id: 'car-yellow-bus', name: '黄色小巴', shape: 'bus', color: '#e5ba4e', legacy: '🐯' },
  { id: 'car-purple-mini', name: '紫色迷你车', shape: 'mini', color: '#a887b5', legacy: '🐱' },
] as const;
export interface Profile { id: string; name: string; avatar: string }

export function isAvatar(value: unknown): boolean {
  return AVATARS.some(avatar => avatar.id === value || avatar.legacy === value);
}

/** Resolve old stored emoji without rewriting profiles or their backups. */
export function avatarFor(value: unknown): typeof AVATARS[number] {
  return AVATARS.find(avatar => avatar.id === value || avatar.legacy === value) ?? AVATARS[0];
}
