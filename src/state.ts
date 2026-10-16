import { Monster } from './systems/battle';
import { AVATARS } from './systems/world';

export interface PlayerState {
  trainerName: string;
  trainerSprite: string;
  party: Monster[];
  activeIndex: number;
  wins: number;
  losses: number;
}

export const state: PlayerState = {
  trainerName: '',
  trainerSprite: 'Hilbert',
  party: [],
  activeIndex: 0,
  wins: 0,
  losses: 0,
};

const SAVE_KEY = 'poke-rpg-save-v1';

interface SaveShape {
  trainerName: string;
  trainerSprite: string;
  party: { num: number; level: number; moves: number[] }[];
  wins: number;
  losses: number;
}

export function saveGame(): void {
  const data: SaveShape = {
    trainerName: state.trainerName,
    trainerSprite: state.trainerSprite,
    party: state.party.map((m) => ({
      num: m.num,
      level: m.level,
      // guardamos los PP actuales por índice
      moves: m.moves.map((s) => s.pp),
    })),
    wins: state.wins,
    losses: state.losses,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function loadGame(): boolean {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw) as SaveShape;
    state.trainerName = data.trainerName;
    state.trainerSprite = data.trainerSprite;
    // una partida guardada con un sprite antiguo/inválido vuelve al por defecto
    if (!AVATARS.some((a) => a.key === state.trainerSprite)) {
      state.trainerSprite = 'Hilbert';
    }
    state.wins = data.wins ?? 0;
    state.losses = data.losses ?? 0;
    state.party = data.party.map((p, idx) => {
      const mon = new Monster(p.num, p.level);
      p.moves.forEach((pp, i) => {
        if (mon.moves[i]) mon.moves[i].pp = pp;
      });
      void idx;
      return mon;
    });
    state.activeIndex = Math.max(0, state.party.findIndex((m) => m.hp > 0));
    if (state.activeIndex < 0) state.activeIndex = 0;
    return state.party.length > 0;
  } catch {
    return false;
  }
}

export function hasSave(): boolean {
  return !!localStorage.getItem(SAVE_KEY);
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
