#!/usr/bin/env python3
"""
Construye el mundo nuevo (Essentials 32px) con autotiling RMXP real.

- Atlas: autotiles (césped, tierra, arena, agua) + objetos (casas, árboles...).
- Zonas: definidas con "blueprints" ASCII para controlar la composición.
- Salidas: public/tilesets/essentials/atlas.{png,json,tsj}
           public/maps/<zona>.tmj  (+ <zona>.json con colisión/encuentros/NPCs)
           /tmp/opencode/prev/world_<zona>.png (previsualización)
"""
import json
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rmxp_autotile import expand_autotile, RMXP_CASES  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ESS = os.path.join(ROOT, '.assets-src', 'essentials')
OUT_TS = os.path.join(ROOT, 'public', 'tilesets', 'essentials')
OUT_MAPS = os.path.join(ROOT, 'public', 'maps')
PREV = '/tmp/opencode/prev'

T = 32
COLS = 16

# vecindario -> forma (tabla del formato RMXP, derivada de un autotile real)
MASK_TO_SHAPE = {
    0x00: 46, 0x01: 44, 0x02: 43, 0x03: 41, 0x04: 42, 0x05: 32, 0x06: 35, 0x07: 19,
    0x08: 45, 0x09: 39, 0x0A: 33, 0x0B: 31, 0x0C: 37, 0x0D: 27, 0x0E: 23, 0x0F: 15,
    0x13: 40, 0x17: 18, 0x1B: 29, 0x1F: 13, 0x26: 34, 0x27: 17, 0x2E: 22, 0x2F: 11,
    0x37: 16, 0x3F: 9, 0x4C: 36, 0x4D: 26, 0x4E: 21, 0x4F: 7, 0x5F: 5, 0x6E: 20,
    0x6F: 3, 0x7F: 1, 0x89: 38, 0x8B: 30, 0x8D: 25, 0x8F: 14, 0x9B: 28, 0x9F: 12,
    0xAF: 10, 0xBF: 8, 0xCD: 24, 0xCF: 6, 0xDF: 4, 0xEF: 2, 0xFF: 0,
}

# --- autotiles (nombre -> ruta) ---
AUTOTILES = {
    'grass': 'Autotiles/Light grass.png',
    'dirt': 'Autotiles/Dirt.png',
    'sand': 'Autotiles/Sand.png',
    'water': 'Autotiles/Still water.png',
}

# --- bloques de objeto (nombre -> (col,row,w,h) en tiles de Outside.png) ---
OUTSIDE = Image.open(os.path.join(ESS, 'Outside.png')).convert('RGBA')
MAG = Image.open(os.path.join(ROOT, 'tools', 'art', 'magiscarf', 'tileset_v3.png')).convert('RGBA')

BLOCKS = {
    'house_blue':   (5, 234, 3, 4),   # tejado azul
    'house_orange': (5, 240, 3, 4),   # tejado naranja
    'tree':         (0, 71, 2, 3),    # árbol redondo
}
# bloques extra fuera de Outside.png: (imagen, col,row,w,h)
EXTRA_BLOCKS = {
    'tallgrass': ('mag', 0, 800, 2, 2),
}
# tiles sueltos de Outside.png (nombre -> (col,row))
TILES = {
    'wall_blue':   (0, 239),
    'wall_orange': (0, 245),
    'bush':        (0, 76),
    'mound':       (0, 78),
}


def build_atlas():
    os.makedirs(OUT_TS, exist_ok=True)
    cells = []
    autotiles = {}
    for name, rel in AUTOTILES.items():
        autotiles[name] = len(cells)
        img = expand_autotile(os.path.join(ESS, rel))
        for s in range(48):
            cells.append(img.crop(((s % 8) * T, (s // 8) * T, (s % 8) * T + T, (s // 8) * T + T)))
    blocks = {}
    for name, (c, r, w, h) in BLOCKS.items():
        blocks[name] = {'start': len(cells), 'w': w, 'h': h}
        for yy in range(h):
            for xx in range(w):
                cells.append(OUTSIDE.crop(((c + xx) * T, (r + yy) * T, (c + xx) * T + T, (r + yy) * T + T)))
    for name, (src, c, r, w, h) in EXTRA_BLOCKS.items():
        img = MAG if src == 'mag' else OUTSIDE
        # r son píxeles para bloques "extra"
        blocks[name] = {'start': len(cells), 'w': w, 'h': h}
        for yy in range(h):
            for xx in range(w):
                cells.append(img.crop((c + xx * T, r + yy * T, c + xx * T + T, r + yy * T + T)))
    tiles = {}
    for name, (c, r) in TILES.items():
        tiles[name] = len(cells)
        cells.append(OUTSIDE.crop((c * T, r * T, c * T + T, r * T + T)))

    rows = (len(cells) + COLS - 1) // COLS
    atlas = Image.new('RGBA', (COLS * T, rows * T), (0, 0, 0, 0))
    for i, im in enumerate(cells):
        atlas.paste(im, ((i % COLS) * T, (i // COLS) * T))
    atlas.save(os.path.join(OUT_TS, 'atlas.png'))
    manifest = {'tileSize': T, 'columns': COLS, 'autotiles': autotiles, 'blocks': blocks, 'tiles': tiles}
    json.dump(manifest, open(os.path.join(OUT_TS, 'atlas.json'), 'w'), indent=2)
    tsj = {'name': 'essentials', 'image': 'atlas.png', 'imagewidth': atlas.width,
           'imageheight': atlas.height, 'tilewidth': T, 'tileheight': T,
           'tilecount': len(cells), 'columns': COLS, 'margin': 0, 'spacing': 0}
    json.dump(tsj, open(os.path.join(OUT_TS, 'atlas.tsj'), 'w'), indent=2)
    print(f'✔ atlas {atlas.width}x{atlas.height} tiles={len(cells)}')
    return manifest


# ----------------------- ZONAS (blueprints ASCII) -----------------------
# . césped   , camino de tierra   ~ agua   T árbol   R roca   b mata
# H casa azul  O casa naranja     S cartel  @ aparición (césped)   e hierba alta
ZONES = {}

ZONES['pueblo'] = {
    'name': 'Pueblo Brote',
    'spawn': None,
    'encounters': 0,
    'rows': [
        "TTTTTTTT.,,TTTTTTTTTTTTTTTTTTTTTTTTTTTT",
        "TTTTTTTT.,,TTTTTTTTTTTTTTTTTTTTTTTTTTTT",
        "TT....TT.,,TT.....TT...........TTTTTTTTT",
        "T........,,.......TT....HHH....TTTTTTTTT",
        "T..HHH...,,.......TT....HHH....TTTTTTTTT",
        "T..HHH...,,.......TT....HHH....TTTTTTTTT",
        "T..HHH...,,.......TT...........TTTTTTTTT",
        "T..HHH...,,....................TTTTTTTTT",
        "T..bbb...,,....................TTTTTTTTT",
        "T........,,.....,,,,,,,........TTTTTTTTT",
        "T........,,,,,,,.,,,,,,,,,,,,,.TTTTTTTTT",
        "T...........##,,,,,,,,,,,,,,,,.TTTTTTTTT",
        "T.......~~~~##,,,,,,,,,,,,,,,,.TTTTTTTTT",
        "T.......~~~~##,,,,,,,,,,,,,,,,.TTTTTTTTT",
        "T.......~~~~##........,,,,,,,,.TTTTTTTTT",
        "T...........,,.........OOOO....TTTTTTTTT",
        "T...........,,.........OOOO....TTTTTTTTT",
        "T...........,,.........OOOO....TTTTTTTTT",
        "T..S....@...,,.........OOOO....TTTTTTTTT",
        "T..........,,,.................TTTTTTTTT",
        "T..........TTT.................TTTTTTTTT",
        "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
        "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
    ],
}

ZONES['praderas'] = {
    'name': 'Praderas Verdes',
    'spawn': None,
    'encounters': 1,
    'rows': [
        "TTTTTTTTTTTTTTTT.,,TTTTTTTTTTTTTTTTTTTTTTTTTTTT",
        "TTTTTT.........T.,,TTTTTTT...TTTTTTTTTTTTTTTTTTT",
        "TT.........ee...T.,,.....ee...........TTTTTTTTTT",
        "T...ee.........TT.,,..........ee........TTTTTTTT",
        "T........ee.......,,......,,,,,.........TTTTTTTT",
        "T......TT.........,,.......,,,....TT....TTTTTTTT",
        "T..ee..TT..ee.....,,.......,,,..eeTTee...TTTTTTT",
        "T.............ee...,,......,,,,.........TTTTTTTT",
        "T....TT..........e.,,........,,,....ee...TTTTTTT",
        "T....TT....,,,.....,,.......TT...........TTTTTTT",
        "T..........,,,.....,,.......TT....ee.....TTTTTTT",
        "T...ee.....,,,,....,,.............TT.....TTTTTTT",
        "T..........~~~~~~~.,,....................TTTTTTT",
        "T.........~~~~~~~~~~,,....ee..........TT.TTTTTTT",
        "T.........~~~~~~~~~.,,....................TTTTTT",
        "T..........~~~~~~~~,,.......TT...........TTTTTTT",
        "T...........~~~~~~.,,.......TT.....ee....TTTTTTT",
        "T..................,,...................TTTTTTTT",
        "T....ee...........,,.........ee..........TTTTTTT",
        "T...........,,,,,,,.........TT..........TTTTTTTT",
        "TT.........,,,..............TT..........TTTTTTTT",
        "TTTTTTTTTTT,,TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
    ],
}

ZONES['bosque'] = {
    'name': 'Bosque Umbrío',
    'spawn': None,
    'encounters': 2,
    'rows': [
        "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
        "TTTTTTTT.,,TTTTTTTTTTTTTTTTTTTTTT",
        "TTTTT....,,.....TTTTTTTTTTTTTTTTT",
        "TTTTTTT..,,....TTTTTTTTTTTTTTT.TT",
        "TTTTTTTee,,....TTTTTTTTTTTTTTT.TT",
        "TTTTTTTee,.....TTTTTTTTTTTTTTT.TT",
        "TTT........,,...TTTTTTTTTTTTTTTTT",
        "TT..TT.....,,,,,,..TTTTTTTTTTTTTT",
        "TT..TT......,,,...TT..TT..TT..TTT",
        "TT.........ee,....TT..TT..TT..TTT",
        "TT...ee....ee,......TT..TT..TT.TT",
        "TT...........,,...,,..TT..TT...TT",
        "TTTT..TT......,..,,,,...TT.....TT",
        "TTTT..TT.....,,,,,,,....ee.....TT",
        "TT..........,,....,,,..........TT",
        "TTTT..ee....,.......TT....ee...TT",
        "TTTT........,.............TT...TT",
        "TTTTTT......,................TTTT",
        "TTTTTT.,,,,,,,.........TT....TTTT",
        "TTTTTTT.,,TTTTTTTTTTTTTTTTTTTTTTT",
    ],
}


def bools(terr, x, y, ch):
    return 0 <= x < len(terr[0]) and 0 <= y < len(terr) and terr[y][x] == ch


def mask_of(terr, x, y, ch):
    g = lambda dx, dy: bools(terr, x + dx, y + dy, ch)
    N, E, S, W = g(0, -1), g(1, 0), g(0, 1), g(-1, 0)
    NE, SE, SW, NW = g(1, -1), g(1, 1), g(-1, 1), g(-1, -1)
    # normaliza: una esquina solo cuenta si sus dos lados están conectados
    NE = NE and N and E
    SE = SE and S and E
    SW = SW and S and W
    NW = NW and N and W
    return (N << 0) | (E << 1) | (S << 2) | (W << 3) | (NE << 4) | (SE << 5) | (SW << 6) | (NW << 7)


def build_zone(zone_id, man):
    z = ZONES[zone_id]
    rows = z['rows']
    H = len(rows)
    W = max(len(r) for r in rows)
    rows = [r.ljust(W, 'T') for r in rows]
    firstgid = 1

    def gid_auto(name, shape):
        return man['autotiles'][name] + shape + firstgid

    def gid_tile(name):
        return man['tiles'][name] + firstgid

    def gid_block(name, x, y):
        b = man['blocks'][name]
        return b['start'] + y * b['w'] + x + firstgid

    base = [gid_auto('grass', 0)] * (W * H)   # relleno de césped (interior)
    layer = [0] * (W * H)
    collision = [[0] * W for _ in range(H)]
    encounters = [[0] * W for _ in range(H)]
    npcs = []
    spawn = {'x': W // 2, 'y': H // 2}

    def set_t(x, y, g):
        if 0 <= x < W and 0 <= y < H:
            layer[y * W + x] = g

    # terrenos con autotile
    for ch in (',', '~'):
        name = {',': 'dirt', '~': 'water'}[ch]
        for y in range(H):
            for x in range(W):
                if rows[y][x] == ch:
                    set_t(x, y, gid_auto(name, MASK_TO_SHAPE[mask_of(rows, x, y, ch)]))
                    if ch == '~':
                        collision[y][x] = 1

    # hierba alta: patrón 2x2 de la hierba alta de Magiscarf
    tg = man['blocks']['tallgrass']
    for y in range(H):
        for x in range(W):
            if rows[y][x] == 'e':
                set_t(x, y, tg['start'] + (y % 2) * tg['w'] + (x % 2) + firstgid)
                encounters[y][x] = 1

    # objetos
    used = [[False] * W for _ in range(H)]

    def stamp_house(x, y, name, wall):
        b = man['blocks'][name]
        for yy in range(b['h']):
            for xx in range(b['w']):
                set_t(x + xx, y + yy, gid_block(name, xx, yy))
                if 0 <= y + yy < H and 0 <= x + xx < W:
                    collision[y + yy][x + xx] = 1
                    used[y + yy][x + xx] = True
        for xx in range(b['w']):
            set_t(x + xx, y + b['h'], gid_tile(wall))
            if 0 <= y + b['h'] < H and 0 <= x + xx < W:
                collision[y + b['h']][x + xx] = 1
                used[y + b['h']][x + xx] = True

    # casas: una por componente conexa (su esquina superior izquierda)
    from collections import deque
    for y in range(H):
        for x in range(W):
            if rows[y][x] not in 'HO' or used[y][x]:
                continue
            ch = rows[y][x]
            # ¿soy la esquina superior izquierda del grupo?
            if (y > 0 and rows[y - 1][x] == ch) or (x > 0 and rows[y][x - 1] == ch):
                continue
            stamp_house(x, y, 'house_blue' if ch == 'H' else 'house_orange',
                        'wall_blue' if ch == 'H' else 'wall_orange')

    for y in range(H):
        for x in range(W):
            if used[y][x]:
                continue
            ch = rows[y][x]
            if ch == 'T':
                for yy in range(3):
                    for xx in range(2):
                        set_t(x + xx, y + yy - 2, gid_block('tree', xx, yy))
                collision[y][x] = 1
            elif ch == 'b':
                set_t(x, y, gid_tile('bush'))
            elif ch == 'S':
                set_t(x, y, gid_tile('bush'))
                collision[y][x] = 1
            elif ch == 'R':
                set_t(x, y, gid_tile('mound'))
                collision[y][x] = 1
            elif ch == '@':
                spawn = {'x': x, 'y': y}

    width_px = W * T
    height_px = H * T

    tmj = {
        'compressionlevel': -1, 'height': H, 'width': W, 'infinite': False,
        'orientation': 'orthogonal', 'renderorder': 'right-down',
        'tiledversion': '1.10.2', 'type': 'map', 'version': '1.10',
        'tilewidth': T, 'tileheight': T, 'nextlayerid': 3, 'nextobjectid': 1,
        'tilesets': [{'firstgid': firstgid, 'name': 'essentials',
                      'image': '../tilesets/essentials/atlas.png',
                      'imagewidth': man['columns'] * T,
                      'imageheight': ((max(max(man['tiles'].values()), max(b['start'] for b in man['blocks'].values())) // man['columns']) + 1) * T,
                      'tilewidth': T, 'tileheight': T,
                      'tilecount': 9999, 'columns': man['columns'], 'margin': 0, 'spacing': 0}],
        'layers': [
            {'id': 1, 'name': 'base', 'type': 'tilelayer', 'x': 0, 'y': 0, 'width': W, 'height': H,
             'opacity': 1, 'visible': True, 'data': base},
            {'id': 2, 'name': 'ground', 'type': 'tilelayer', 'x': 0, 'y': 0, 'width': W, 'height': H,
             'opacity': 1, 'visible': True, 'data': layer},
        ],
    }
    os.makedirs(OUT_MAPS, exist_ok=True)
    json.dump(tmj, open(os.path.join(OUT_MAPS, f'{zone_id}.tmj'), 'w'))

    side = {'id': zone_id, 'name': z['name'], 'width': W, 'height': H, 'tile': T,
            'collision': collision, 'encounters': encounters, 'npcs': npcs,
            'warps': [], 'spawn': spawn}
    json.dump(side, open(os.path.join(OUT_MAPS, f'{zone_id}.json'), 'w'))

    # preview
    os.makedirs(PREV, exist_ok=True)
    atlas = Image.open(os.path.join(OUT_TS, 'atlas.png')).convert('RGBA')
    canvas = Image.new('RGBA', (width_px, height_px))
    for y in range(H):
        for x in range(W):
            for arr in (base, layer):
                g = arr[y * W + x]
                if not g:
                    continue
                i = g - firstgid
                canvas.alpha_composite(atlas.crop(((i % COLS) * T, (i // COLS) * T, (i % COLS) * T + T, (i // COLS) * T + T)), (x * T, y * T))
    canvas.convert('RGB').save(os.path.join(PREV, f'world_{zone_id}.png'))
    print(f'✔ {zone_id}: {W}x{H}  enc={z["encounters"]}')


if __name__ == '__main__':
    man = build_atlas()
    for zid in sys.argv[1:] or list(ZONES):
        build_zone(zid, man)
