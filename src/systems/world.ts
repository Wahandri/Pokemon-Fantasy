export interface WildTable {
  rate: number;
  table: { num: number; min: number; max: number }[];
}

export interface GameMap {
  id: string;
  name: string;
  width: number;
  height: number;
  tile: number;
  collision: number[][];
  encounters: number[][];
  npcs: { sprite: string; x: number; y: number }[];
  warps: { x: number; y: number; dest: string }[];
  spawn: { x: number; y: number };
  wild?: WildTable;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Conexiones reales entre mapas (del juego original: Littleroot ↔ Ruta101 ↔
 * Oldale ↔ Ruta102). Al salir por un borde se entra por el opuesto.
 */
export const LINKS: Record<string, Partial<Record<Direction, string>>> = {
  moki: { up: 'route3', down: 'route1' },
  route1: { up: 'moki', down: 'route2' },
  route2: { up: 'route1', down: 'nowtoch' },
  nowtoch: { up: 'route2', down: 'kevlar' },
  kevlar: { up: 'nowtoch', down: 'burole' },
  burole: { up: 'kevlar' },
  route3: { down: 'moki' },
};

/** Sprite de personaje por defecto (jugador). */
export const DEFAULT_PLAYER = 'Hilbert';

/** Avatares disponibles para elegir entrenador (protagonistas de Gen 5). */
export const AVATARS: { key: string; name: string }[] = [
  { key: 'Hilbert', name: 'Hilbert' },
  { key: 'Hilda', name: 'Hilda' },
  { key: 'Nate', name: 'Nate' },
  { key: 'Rosa', name: 'Rosa' },
  { key: 'Cheren', name: 'Cheren' },
  { key: 'Bianca', name: 'Bianca' },
  { key: 'Ace_Trainer_M', name: 'Ace M' },
  { key: 'Ace_Trainer_F', name: 'Ace F' },
  { key: 'Youngster', name: 'Joven' },
  { key: 'Lass', name: 'Chica' },
  { key: 'Black_Belt', name: 'Karateka' },
  { key: 'Beauty', name: 'Belleza' },
];

/**
 * Traduce los nombres de sprite del juego base (pokeemerald) a los sprites de
 * Gen 5 (estilo DS). Si no hay equivalencia, se usa `Youngster`.
 */
export const PE_TO_OW5: Record<string, string> = {
  boy_1: 'Youngster', boy_2: 'Schoolkid_M', boy_3: 'Youngster',
  girl_1: 'Lass', girl_2: 'Schoolkid_F', girl_3: 'Lass',
  little_boy: 'Schoolkid_M', little_girl: 'Schoolkid_F',
  twin: 'Schoolkid_M', fat_man: 'Gentleman', maniac: 'Scientist_M',
  bug_catcher: 'Schoolkid_M', berry_tree: 'Youngster',
  man_1: 'Backpacker_M', man_2: 'Backpacker_M', man_3: 'Worker', man_4: 'Backpacker_M', man_5: 'Hiker',
  woman_1: 'Backpacker_F', woman_2: 'Backpacker_F', woman_3: 'Clerk_F', woman_4: 'Backpacker_F', woman_5: 'Lady',
  mom: 'Lady', prof_birch: 'Prof_Aurea_Juniper', prof_oak: 'Prof_Cedric_Juniper',
  cameraman: 'Clerk_M', artist: 'Beauty', beauty: 'Beauty', black_belt: 'Black_Belt',
  youngster: 'Youngster', lass: 'Lass', hiker: 'Hiker', fisherman: 'Fisherman',
  mart_employee: 'Clerk_M', nurse: 'Nurse', scientist: 'Scientist_M',
};

export function ow5For(peName: string): string {
  return PE_TO_OW5[peName] ?? peName ?? 'Youngster';
}

/** Los sprites tienen el origen abajo, así que `y` es el pie del personaje. */
export function feetTile(x: number, y: number, tile = 16): { tx: number; ty: number } {
  return { tx: Math.floor(x / tile), ty: Math.floor((y - 1) / tile) };
}
