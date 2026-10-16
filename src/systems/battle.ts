import { buildMoveset, getSpecies, type MoveData, type SpeciesData } from '../data';
import { effectiveness } from './typeChart';

export interface MoveSlot {
  move: MoveData;
  pp: number;
  maxPp: number;
}

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

const IV = 15; // simplificado para el slice (máximo real = 31)
const EV = 0;

function statFormula(base: number, level: number): number {
  return Math.floor(((2 * base + IV + Math.floor(EV / 4)) * level) / 100) + 5;
}

export function computeStats(species: SpeciesData, level: number): Stats {
  const b = species.baseStats;
  return {
    hp: Math.floor(((2 * b.hp + IV + Math.floor(EV / 4)) * level) / 100) + level + 10,
    atk: statFormula(b.atk, level),
    def: statFormula(b.def, level),
    spa: statFormula(b.spa, level),
    spd: statFormula(b.spd, level),
    spe: statFormula(b.spe, level),
  };
}

export class Monster {
  species: SpeciesData;
  level: number;
  stats: Stats;
  hp: number;
  moves: MoveSlot[];
  boosts: { atk: number; def: number; spa: number; spd: number; spe: number } = {
    atk: 0, def: 0, spa: 0, spd: 0, spe: 0,
  };

  constructor(num: number, level: number) {
    this.species = getSpecies(num);
    this.level = level;
    this.stats = computeStats(this.species, level);
    this.hp = this.stats.hp;
    this.moves = buildMoveset(num, 4).map((m) => ({ move: m, pp: m.pp, maxPp: m.pp }));
  }

  get name(): string {
    return this.species.name;
  }

  get num(): number {
    return this.species.num;
  }

  isFainted(): boolean {
    return this.hp <= 0;
  }

  hpRatio(): number {
    return this.hp / this.stats.hp;
  }

  /** Estadística efectiva aplicando los boosts de -6..+6. */
  effective(stat: keyof Stats): number {
    const base = this.stats[stat];
    if (stat === 'hp') return base;
    const stages = this.boosts[stat as keyof typeof this.boosts] ?? 0;
    const mult = stages >= 0 ? (2 + stages) / 2 : 2 / (2 - stages);
    return Math.floor(base * mult);
  }

  useMove(index: number): MoveSlot | null {
    const slot = this.moves[index];
    if (!slot || slot.pp <= 0) return null;
    slot.pp -= 1;
    return slot;
  }

  /** Primer movimiento con PP (para la IA). */
  firstAvailableMove(): number {
    return this.moves.findIndex((m) => m.pp > 0);
  }
}

export interface DamageResult {
  damage: number;
  effectiveness: number;
  crit: boolean;
  missed: boolean;
}

/** Fórmula de daño Gen 5 simplificada. */
export function calcDamage(attacker: Monster, defender: Monster, move: MoveData): DamageResult {
  if (move.category === 'Status' || move.power <= 0) {
    return { damage: 0, effectiveness: 1, crit: false, missed: false };
  }

  // Precisión
  if (Math.random() * 100 > move.accuracy) {
    return { damage: 0, effectiveness: 1, crit: false, missed: true };
  }

  const isSpecial = move.category === 'Special';
  const atk = attacker.effective(isSpecial ? 'spa' : 'atk');
  const def = defender.effective(isSpecial ? 'spd' : 'def');

  const eff = effectiveness(move.type, defender.species.types);
  if (eff === 0) return { damage: 0, effectiveness: 0, crit: false, missed: false };

  const crit = Math.random() < 1 / 16;
  const stab = attacker.species.types.includes(move.type) ? 1.5 : 1;
  const rand = 0.85 + Math.random() * 0.15;

  const base = Math.floor(
    (Math.floor((2 * attacker.level) / 5 + 2) * move.power * (atk / def)) / 50 + 2,
  );
  const damage = Math.max(1, Math.floor(base * stab * eff * rand * (crit ? 1.5 : 1)));

  return { damage, effectiveness: eff, crit, missed: false };
}

export type { MoveData, SpeciesData };
