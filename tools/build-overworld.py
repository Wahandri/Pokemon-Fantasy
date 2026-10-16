#!/usr/bin/env python3
"""
Convierte mapas, tilesets y sprites de personajes del decompilado oficial de
Pokémon Esmeralda (pret/pokeemerald) a assets listos para Phaser.

- Renderiza cada mapa a PNG RGBA (capa base + capa superior) aplicando las
  paletas reales de los tilesets.
- Extrae la rejilla de colisión (bits de colisión del propio bloque del mapa).
- Exporta NPCs y warps reales desde data/maps/<Map>/map.json.
- Convierte los sprites de personajes (jugador/NPCs) a PNG RGBA (índice 0 = transparente).

Entradas:  .decomp/ (ver tools/fetch-overworld.sh)
Salidas:   public/maps/<id>.png, <id>_top.png, <id>.json
           public/ow/<sprite>.png
"""
import json
import os
import struct
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DECOMP = os.path.join(ROOT, '.decomp')
OUT_MAPS = os.path.join(ROOT, 'public', 'maps')
OUT_OW = os.path.join(ROOT, 'public', 'ow')

# Bloques: 10 bits metatile, 2 bits colisión, 4 bits elevación
METATILE_MASK = 0x03FF
COLLISION_MASK = 0x0C00
NUM_METATILES_IN_PRIMARY = 512
NUM_PALS_IN_PRIMARY = 6

# Mapas que queremos (id de layout -> id corto de salida)
MAPS = {
    'LittlerootTown': 'littleroot',
    'Route101': 'route101',
    'OldaleTown': 'oldale',
    'Route102': 'route102',
}

# Sprites de personaje a exportar (ruta relativa dentro de pics/people)
SPRITES = [
    'brendan/walking', 'brendan/running',
    'may/walking', 'may/running',
    'twin', 'boy_1', 'boy_2', 'boy_3', 'little_boy', 'girl_1', 'girl_2', 'little_girl',
    'fat_man', 'man_1', 'man_2', 'man_3', 'man_4', 'man_5',
    'woman_1', 'woman_2', 'woman_3', 'woman_4', 'woman_5',
    'mom', 'prof_birch', 'truck', 'cameraman', 'artist', 'beauty', 'black_belt',
]


def load_pal(path):
    with open(path, 'r', encoding='latin1') as f:
        lines = f.read().replace('\r', '').split('\n')
    colors = []
    for i in range(3, 3 + 16):
        r, g, b = map(int, lines[i].split())
        colors.append((r, g, b))
    return np.array(colors, dtype=np.uint8)


def load_tileset(folder):
    tiles = Image.open(os.path.join(folder, 'tiles.png'))
    idx = np.array(tiles, dtype=np.uint8)  # (H, W) índices de paleta
    with open(os.path.join(folder, 'metatiles.bin'), 'rb') as f:
        raw = f.read()
    metas = [struct.unpack_from('<8H', raw, i * 16) for i in range(len(raw) // 16)]
    with open(os.path.join(folder, 'metatile_attributes.bin'), 'rb') as f:
        araw = f.read()
    attrs = [struct.unpack_from('<H', araw, i * 2)[0] for i in range(len(araw) // 2)]
    pals = [load_pal(os.path.join(folder, 'palettes', f'{i:02d}.pal')) for i in range(16)]
    return {'idx': idx, 'metas': metas, 'attrs': attrs, 'pals': pals}


def tile_rgba(ts, tile_index, pal_index, xflip, yflip, transparent_zero):
    local = tile_index if tile_index < NUM_METATILES_IN_PRIMARY else tile_index - NUM_METATILES_IN_PRIMARY
    tx = (local % 16) * 8
    ty = (local // 16) * 8
    block = ts['idx'][ty:ty + 8, tx:tx + 8]
    if block.shape != (8, 8):
        return np.zeros((8, 8, 4), dtype=np.uint8)
    if xflip:
        block = np.fliplr(block)
    if yflip:
        block = np.flipud(block)
    pal = ts['pals'][pal_index & 0xF]
    rgba = np.concatenate([pal[block], np.full((8, 8, 1), 255, np.uint8)], axis=2)
    if transparent_zero:
        mask = block == 0
        rgba[mask, 3] = 0
    return rgba


def combined_palette(primary, secondary, pal_index):
    if pal_index < NUM_PALS_IN_PRIMARY:
        return primary['pals'][pal_index], 'primary'
    return secondary['pals'][pal_index - NUM_PALS_IN_PRIMARY], 'secondary'


def render_map(layout, primary, secondary, blockdata):
    w, h = layout['width'], layout['height']
    base = np.zeros((h * 16, w * 16, 4), dtype=np.uint8)
    top = np.zeros((h * 16, w * 16, 4), dtype=np.uint8)
    collision = np.zeros((h, w), dtype=np.uint8)
    encounters = np.zeros((h, w), dtype=np.uint8)
    # Behaviors de hierba (MB_TALL_GRASS=2, MB_LONG_GRASS=3, MB_SHORT_GRASS=7)
    GRASS_BEHAVIORS = {2, 3, 7}
    # Bloqueados a pie aunque el bit de colisión sea 0:
    # agua (16-26), impasables (48-55) y salientes (56-63)
    BLOCKED_BEHAVIORS = set(range(16, 27)) | set(range(48, 64))

    for by in range(h):
        for bx in range(w):
            block = struct.unpack_from('<H', blockdata, (by * w + bx) * 2)[0]
            if block & COLLISION_MASK:
                collision[by, bx] = 1
            metatile = block & METATILE_MASK
            if metatile < NUM_METATILES_IN_PRIMARY:
                meta = primary['metas'][metatile]
                attr = primary['attrs'][metatile] if metatile < len(primary['attrs']) else 0
            else:
                mi = metatile - NUM_METATILES_IN_PRIMARY
                meta = secondary['metas'][mi]
                attr = secondary['attrs'][mi] if mi < len(secondary['attrs']) else 0
            behavior = attr & 0xFF
            if behavior in GRASS_BEHAVIORS:
                encounters[by, bx] = 1
            if behavior in BLOCKED_BEHAVIORS:
                collision[by, bx] = 1

            for layer, (canvas, transparent) in enumerate([(base, False), (top, True)]):
                for i in range(4):
                    entry = meta[layer * 4 + i]
                    tile_index = entry & 0x03FF
                    xflip = (entry >> 10) & 1
                    yflip = (entry >> 11) & 1
                    pal_index = (entry >> 12) & 0xF
                    # El tileset lo determina el ÍNDICE DEL TILE; la paleta es de ese tileset
                    tile_ts = primary if tile_index < NUM_METATILES_IN_PRIMARY else secondary
                    pal = tile_ts['pals'][pal_index]
                    local = tile_index if tile_index < NUM_METATILES_IN_PRIMARY else tile_index - NUM_METATILES_IN_PRIMARY
                    tx = (local % 16) * 8
                    ty = (local // 16) * 8
                    blockpix = tile_ts['idx'][ty:ty + 8, tx:tx + 8]
                    if blockpix.shape != (8, 8):
                        continue
                    if xflip:
                        blockpix = np.fliplr(blockpix)
                    if yflip:
                        blockpix = np.flipud(blockpix)
                    rgba = np.concatenate([pal[blockpix], np.full((8, 8, 1), 255, np.uint8)], axis=2)
                    if transparent:
                        rgba[blockpix == 0, 3] = 0
                    px = bx * 16 + (i % 2) * 8
                    py = by * 16 + (i // 2) * 8
                    canvas[py:py + 8, px:px + 8] = rgba
    return base, top, collision, encounters


def gfx_to_sprite(graphics_id):
    return graphics_id.replace('OBJ_EVENT_GFX_', '').lower()


def main():
    os.makedirs(OUT_MAPS, exist_ok=True)
    os.makedirs(OUT_OW, exist_ok=True)

    ts_primary = load_tileset(os.path.join(DECOMP, 'data/tilesets/primary/general'))
    ts_secondary = load_tileset(os.path.join(DECOMP, 'data/tilesets/secondary/petalburg'))

    with open(os.path.join(DECOMP, 'data/layouts/layouts.json')) as f:
        layouts = {l['id']: l for l in json.load(f)['layouts']}

    for map_name, out_id in MAPS.items():
        with open(os.path.join(DECOMP, f'data/maps/{map_name}/map.json')) as f:
            mj = json.load(f)
        layout = layouts[mj['layout']]
        with open(os.path.join(DECOMP, layout['blockdata_filepath']), 'rb') as f:
            blockdata = f.read()

        base, top, collision, encounters = render_map(layout, ts_primary, ts_secondary, blockdata)

        Image.fromarray(base, 'RGBA').save(os.path.join(OUT_MAPS, f'{out_id}.png'))
        Image.fromarray(top, 'RGBA').save(os.path.join(OUT_MAPS, f'{out_id}_top.png'))

        npcs = []
        for ev in mj.get('object_events', []):
            if str(ev.get('flag', '0')) != '0':
                continue  # oculto al inicio
            gid = ev.get('graphics_id', '')
            if gid in ('OBJ_EVENT_GFX_VAR_0', 'OBJ_EVENT_GFX_VAR_1'):
                continue
            npcs.append({'sprite': gfx_to_sprite(gid), 'x': ev['x'], 'y': ev['y']})

        warps = [{'x': w['x'], 'y': w['y'], 'dest': w.get('dest_map', '')} for w in mj.get('warp_events', [])]

        # Punto de aparición: primer bloque transitable cerca del centro
        spawn = {'x': layout['width'] // 2, 'y': layout['height'] // 2}
        for r in range(1, 12):
            found = False
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    x, y = spawn['x'] + dx, spawn['y'] + dy
                    if 0 <= x < layout['width'] and 0 <= y < layout['height'] and not collision[y, x]:
                        spawn = {'x': x, 'y': y}
                        found = True
                        break
                if found:
                    break
            if found:
                break

        out = {
            'id': out_id,
            'name': mj['name'],
            'width': layout['width'],
            'height': layout['height'],
            'tile': 16,
            'collision': collision.tolist(),
            'encounters': encounters.tolist(),
            'npcs': npcs,
            'warps': warps,
            'spawn': spawn,
        }
        with open(os.path.join(OUT_MAPS, f'{out_id}.json'), 'w') as f:
            json.dump(out, f)
        print(f"✔ {out_id:10s} {layout['width']}x{layout['height']}  npcs={len(npcs)} warps={len(warps)} spawn=({spawn['x']},{spawn['y']})")

    # Personajes: se exportan TODOS los sprites de personas del juego base
    people = os.path.join(DECOMP, 'graphics/object_events/pics/people')
    all_sprites = []
    for dirpath, _dirs, files in os.walk(people):
        for fn in files:
            if fn.endswith('.png'):
                all_sprites.append(os.path.join(dirpath, fn))
    # Deduplica quedándose con la versión principal (p. ej. women/men)
    seen_out = set()
    for src in sorted(all_sprites):
        rel = os.path.relpath(src, people)[:-4]  # sin .png
        name = rel.replace('/', '_')
        if name in seen_out:
            continue
        seen_out.add(name)
        im = Image.open(src)
        idx = np.array(im, dtype=np.uint8)
        pal = np.array(im.getpalette()[:48], dtype=np.uint8).reshape(16, 3)
        rgba = np.concatenate([pal[idx], np.full((*idx.shape, 1), 255, np.uint8)], axis=2)
        rgba[idx == 0, 3] = 0  # índice 0 = transparente
        Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT_OW, f'{name}.png'))
    print(f"✔ personajes exportados: {len([f for f in os.listdir(OUT_OW) if f.endswith('.png')])}")


if __name__ == '__main__':
    main()
