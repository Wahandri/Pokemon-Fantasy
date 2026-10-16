# 🔴 Pokémon League Online

RPG Pokémon **de navegador** con **mapas y sprites del juego base real** (Pokémon Esmeralda,
decompilado oficial) y el **sistema de lucha oficial de Pokémon Showdown**.

- **URL**: https://pokefantasy.wahandri.com
- **Motor gráfico**: Phaser 3 + TypeScript + Vite.
- **Combate**: **`@pkmn/sim`** (el mismo motor de Pokémon Showdown que usa la escena competitiva).
- **Datos**: `@pkmn/dex` + `@pkmn/data` (Pokédex 1–150).
- **Mundo**: mapas **rediseñados en HD** con tilesets de fans (**Magiscarf**, 32px) cargados como
  mapas **Tiled** en runtime; personajes de sobremundo y datos de colisión/encuentros reales de
  **pret/pokeemerald**.

---

## ▶️ Qué se puede jugar

1. **Menú** → **elegir entrenador** (nombre + 12 avatares reales del juego).
2. **Primer Pokémon**: **3 al azar**, de primera evolución, **sin legendarios**.
3. **Mundo real**: **Littleroot Town → Ruta 101 → Oldale Town → Ruta 102**, con transiciones por
   los bordes, colisión real, **NPCs** colocados en sus posiciones originales y **hierba alta**.
4. **Combate por turnos con el motor oficial**: daño, tipos, STAB, precisión, estados
   (p. ej. *Static* paraliza), PP, críticos, debilitamiento… resueltos por `@pkmn/sim`.
5. Guardado local (nivel, PS, récord V/D).

Atajos de desarrollo: `?debug=menu|trainer|starter|overworld|battle`. Para el overworld puedes
elegir mapa con `?debug=overworld&map=route102`.

---

## 🧱 Cómo se consiguen los assets

Gráficos **modernos en HD** (32px) de fans, combinados con los **datos reales** del juego base:

```
tools/fetch-tilesets.sh    # descarga tilesets de exterior de Magiscarf (DeviantArt)
                           #   -> tools/art/magiscarf/*.png  (restaura el alfa del damero)
tools/build-tileset.py     # arma el atlas curado de Phaser/Tiled:
                           #   - terreno: césped (procedural), camino, agua animada, hierba alta
                           #   - árboles, vallas, casas (bloques multi-tile)
                           #   -> public/tilesets/magiscarf/outdoor.{png,json,tsj}
tools/build-tiled-maps.py  # genera los mapas Tiled .tmj a partir de los datos actuales:
                           #   - clasifica cada celda (agua/hierba alta con los BEHAVIORS reales
                           #     del decomp; árboles/casas/caminos por análisis del mapa actual)
                           #   - conserva colisión, encuentros, NPCs, warps y spawn
                           #   -> public/maps/<id>.tmj
tools/crop-grid.py         # utilidad de desarrollo: recorta un tileset con rejilla+coords
tools/tiles-preview.py     # utilidad de desarrollo: previsualiza el atlas con etiquetas
```

Atajos: `npm run assets` (atlas + mapas), `npm run assets:fetch` (descargar tilesets).

Los **datos de colisión, encuentros, NPCs, warps y spawn** siguen saliendo del decompilado de
Esmeralda (`tools/fetch-overworld.sh` + `tools/build-overworld.py`) y se guardan en
`public/maps/<id>.json`. El motor lo carga todo junto: el `.tmj` para dibujar y el `.json` para la lógica.

---

## 🗺️ Mapas incluidos

| id | Mapa | Tamaño | NPCs |
|----|------|--------|------|
| `littleroot` | Littleroot Town | 20×20 | 2 |
| `route101` | Ruta 101 | 20×20 | 1 |
| `oldale` | Oldale Town | 20×20 | 3 |
| `route102` | Ruta 102 | 50×20 | 8 |

Conexiones (reales del juego): `littleroot ↔ route101 ↔ oldale ↔ route102`.

---

## 🛠️ Desarrollo y despliegue

```bash
npm install
npm run dev            # http://localhost:3510
npm run build          # genera dist/
cd /opt/server && docker compose up -d --build pokefantasy
```

**Red**: `navegador → Cloudflare → Caddy (:80) → pokefantasy (:3400, nginx)`.

---

## 🗺️ Roadmap

- [x] Mapas, tilesets y sprites **reales** del juego base + NPCs.
- [x] Combate por turnos con el **motor oficial** (`@pkmn/sim`).
- [ ] **Entrenadores NPC que te retan** al verte (los sprites ya están).
- [ ] Animaciones de ataque reales (`battle-anims/*.json` + `images/battle_anims/`).
- [ ] Equipo de 6, cambio de Pokémon y **captura con Poké Balls**.
- [ ] **PvP online** (ambos conectados) con el mismo motor.
- [ ] **Liga** por entrenador con más victorias.
- [ ] Legendarios **solo por eventos**.

---

## ⚖️ Créditos y licencia

- **Tilesets de exterior (HD, 32px)**: **Magiscarf** (DeviantArt) — crédito obligatorio, uso no comercial.
- **Datos de mapas/colisión/encuentros**: **pret/pokeemerald** (decompilado de Pokémon Esmeralda).
- **Sprites de personajes**: pack «Ultimate Gen 5 Overworlds».
- **Motor de combate**: **`@pkmn/sim`** (Pokémon Showdown).
- **Datos**: **`@pkmn/dex` / `@pkmn/data`**. **Sprites de Pokémon**: `pokerogue-assets`.
- Pokémon © Nintendo / Creatures Inc. / GAME FREAK inc.
- **Uso personal / entre amigos, no comercial.** Proyecto no afiliado a Nintendo.
# Pokemon-Fantasy
