// Genera los datos de juego (especies, movimientos y learnsets) para el
// Pokédex 1..150 usando @pkmn/dex + @pkmn/data (datos oficiales de Pokémon).
//
//   node tools/gen-data.mjs
//
// Salida: src/data/species.json, src/data/moves.json, src/data/learnsets.json
import { Dex } from '@pkmn/dex';
import { Generations } from '@pkmn/data';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'src', 'data');
mkdirSync(OUT, { recursive: true });

const MAX_DEX = 150;
const GEN = 5; // sprites y movimientos estilo Gen 5
const LEGENDARIES = new Set([144, 145, 146, 150]); // Articuno, Zapdos, Moltres, Mewtwo

const gens = new Generations(Dex);
const gen = gens.get(GEN);

const speciesOut = [];
const learnsetsOut = {};
const movesNeeded = new Set();

// Reúne las especies base 1..150 (sin formas alternativas)
const targets = Array.from(gen.species).filter(
  (s) => s.num >= 1 && s.num <= MAX_DEX && s.name === s.baseSpecies,
);

for (const s of targets) {
  const evoList = Object.values(s.evos ?? {}).map((name) => {
    const e = gen.species.get(name);
    return e ? { name: e.name, num: e.num } : null;
  }).filter(Boolean);

  speciesOut.push({
    num: s.num,
    name: s.name,
    types: s.types,
    baseStats: s.baseStats,
    abilities: Object.values(s.abilities),
    prevo: s.prevo ?? null,
    evos: evoList,
    isLegendary: LEGENDARIES.has(s.num),
    // "Base stage": no preevolución → apto para el inicio aleatorio
    isBase: !s.prevo,
  });

  // Learnset Gen 5 (API asíncrona)
  const ls = await gen.learnsets.get(s.name);
  const moveNames = Object.keys(ls?.learnset ?? {})
    .map((id) => gen.moves.get(id))
    .filter((m) => m && m.basePower !== undefined);

  // Prioriza STAB, luego cobertura ofensiva, luego estados útiles
  const stab = moveNames.filter((m) => s.types.includes(m.type) && (m.basePower ?? 0) > 0);
  const coverage = moveNames.filter((m) => !s.types.includes(m.type) && (m.basePower ?? 0) > 0);
  const status = moveNames.filter((m) => m.category === 'Status');
  const seen = new Set();
  const chosen = [...stab, ...coverage, ...status].filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  }).slice(0, 10);

  learnsetsOut[s.num] = chosen.map((m) => m.id);
  for (const m of chosen) movesNeeded.add(m.id);
}

const movesOut = {};
for (const id of movesNeeded) {
  const m = gen.moves.get(id);
  if (!m) continue;
  movesOut[m.id] = {
    id: m.id,
    name: m.name,
    type: m.type,
    category: m.category, // 'Physical' | 'Special' | 'Status'
    power: m.basePower ?? 0,
    accuracy: m.accuracy === true ? 100 : (m.accuracy ?? 100),
    pp: m.pp ?? 10,
    priority: m.priority ?? 0,
    target: m.target,
    desc: m.shortDesc ?? '',
  };
}

writeFileSync(join(OUT, 'species.json'), JSON.stringify(speciesOut));
writeFileSync(join(OUT, 'moves.json'), JSON.stringify(movesOut));
writeFileSync(join(OUT, 'learnsets.json'), JSON.stringify(learnsetsOut));

const baseStarters = speciesOut.filter((s) => s.isBase && !s.isLegendary).length;
console.log(`✅ species: ${speciesOut.length} | moves: ${Object.keys(movesOut).length} | starters base: ${baseStarters}`);
console.log(`   legendarios excluidos del inicio: ${[...LEGENDARIES].join(', ')}`);
