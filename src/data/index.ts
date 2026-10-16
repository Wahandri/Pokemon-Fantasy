import speciesJson from './species.json';
import movesJson from './moves.json';
import learnsetsJson from './learnsets.json';

export type PType =
  | 'Normal' | 'Fire' | 'Water' | 'Electric' | 'Grass' | 'Ice'
  | 'Fighting' | 'Poison' | 'Ground' | 'Flying' | 'Psychic' | 'Bug'
  | 'Rock' | 'Ghost' | 'Dragon' | 'Dark' | 'Steel' | 'Fairy';

export interface SpeciesData {
  num: number;
  name: string;
  types: PType[];
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  abilities: string[];
  prevo: string | null;
  evos: { name: string; num: number }[];
  isLegendary: boolean;
  isBase: boolean;
}

export interface MoveData {
  id: string;
  name: string;
  type: PType;
  category: 'Physical' | 'Special' | 'Status';
  power: number;
  accuracy: number;
  pp: number;
  priority: number;
  target: string;
  desc: string;
}

export const SPECIES = speciesJson as unknown as SpeciesData[];
export const MOVES = movesJson as unknown as Record<string, MoveData>;
export const LEARNSETS = learnsetsJson as unknown as Record<string, string[]>;

const byNum = new Map<number, SpeciesData>(SPECIES.map((s) => [s.num, s]));

export function getSpecies(num: number): SpeciesData {
  const s = byNum.get(num);
  if (!s) throw new Error(`Especie ${num} no encontrada`);
  return s;
}

export function getMove(id: string): MoveData {
  const m = MOVES[id];
  if (!m) throw new Error(`Movimiento ${id} no encontrado`);
  return m;
}

export function getLearnset(num: number): MoveData[] {
  return (LEARNSETS[String(num)] ?? []).map(getMove).filter(Boolean);
}

/** Pokémon de primera evolución y no legendarios: aptos para el inicio aleatorio. */
export function baseStarters(): SpeciesData[] {
  return SPECIES.filter((s) => s.isBase && !s.isLegendary);
}

/** Devuelve N starters aleatorios distintos. */
export function randomStarters(n = 3, exclude: number[] = []): SpeciesData[] {
  const pool = baseStarters().filter((s) => !exclude.includes(s.num));
  const picked: SpeciesData[] = [];
  while (picked.length < n && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

/** Elige hasta `count` movimientos de ataque + estado a partir del learnset. */
export function buildMoveset(num: number, count = 4): MoveData[] {
  const ls = getLearnset(num);
  const sp = getSpecies(num);
  const stab = ls.filter((m) => sp.types.includes(m.type) && m.power > 0);
  const coverage = ls.filter((m) => !sp.types.includes(m.type) && m.power > 0);
  const status = ls.filter((m) => m.category === 'Status');
  const priority = (m: MoveData) => (m.priority > 0 ? -1 : 0);

  const ordered = [
    ...stab.sort((a, b) => priority(a) - priority(b)).slice(0, 2),
    ...coverage.slice(0, 1),
    ...status.slice(0, 1),
    ...stab.slice(2),
    ...coverage.slice(1),
    ...status.slice(1),
  ];

  const seen = new Set<string>();
  const out: MoveData[] = [];
  for (const m of ordered) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
    if (out.length >= count) break;
  }
  return out;
}
