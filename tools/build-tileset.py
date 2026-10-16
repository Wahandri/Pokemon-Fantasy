#!/usr/bin/env python3
"""
Construye el tileset curado de exterior a partir de los sheets de Magiscarf
(tools/art/magiscarf/) y emite:
  - public/tilesets/magiscarf/outdoor.png   (atlas 32px)
  - public/tilesets/magiscarf/outdoor.json  (manifest: nombre -> índice)
  - public/tilesets/magiscarf/outdoor.tsj   (tileset de Tiled)

El atlas se organiza en una rejilla de COLS columnas. Los "blocks" (casas de
varias tiles) se colocan empezando en una fila nueva para poder estamparlos
como bloque w×h.

El césped base se genera de forma procedural (seamless) usando una paleta
armonizada con el resto del tileset.
"""
import json
import os
import random
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'art', 'magiscarf')
OUT = os.path.join(ROOT, 'public', 'tilesets', 'magiscarf')

T = 32          # tamaño de tile
COLS = 16       # columnas del atlas (los tiles se colocan sin huecos)

# --- Tiles sueltos: nombre -> (sheet, x, y) en píxeles del sheet original ---
SINGLES = {
    # terreno
    'tallgrass':  ('tileset_v3', 0, 800),
    'tallgrass2': ('tileset_v3', 32, 800),
    'tallgrass3': ('tileset_v3', 0, 832),
    'tallgrass4': ('tileset_v3', 32, 832),
    'tallgrass_a': ('tileset_v3', 16, 864),   # matas sueltas
    'path':       ('tileset_v3', 672, 992),
    'path2':      ('misc_tiles', 0, 192),
    'dirt':       ('further_tiles', 448, 160),
    'water':      ('further_tiles', 480, 224),
    'water2':     ('further_tiles', 512, 224),
    'water3':     ('further_tiles', 448, 224),
    'bush':       ('further_tiles', 512, 96),
    'fence':      ('city_tiles', 64, 384),
    # árboles (2 tiles de alto: top + bot)
    'tree_top':   ('more_trees', 0, 0),
    'tree_bot':   ('more_trees', 0, 32),
    'tree2_top':  ('more_trees', 64, 0),
    'tree2_bot':  ('more_trees', 64, 32),
    'pine_top':   ('more_trees', 32, 0),
    'pine_bot':   ('more_trees', 32, 32),
}

# --- Blocks (casas): nombre -> (sheet, x, y, w, h) en tiles ---
BLOCKS = {
    'house1': ('frlg_house', 0, 0, 5, 5),
    'house2': ('frlg_house', 160, 0, 4, 4),
    'house3': ('frlg_house', 160, 96, 3, 2),
}

# Paleta de césped (armonizada con el verde de Magiscarf).
GRASS_PALETTE = {
    'base':  (90, 176, 74, 255),
    'dark':  (74, 156, 62, 255),
    'light': (110, 194, 92, 255),
    'tuft':  (60, 138, 52, 255),
}

cache = {}

# --- El CDN de DeviantArt sirve PNG sin alfa con un damero horneado.
#     Lo detectamos y lo volvemos transparente (solo el fondo conectado al borde).
CHECKER = ((255, 255, 255), (229, 236, 232))

def dechecker(im):
    import numpy as np
    from scipy import ndimage
    arr = np.asarray(im.convert('RGB')).astype(np.int16)
    near = np.zeros(arr.shape[:2], dtype=bool)
    for col in CHECKER:
        c = np.array(col, dtype=np.int16)
        near |= (np.abs(arr - c).max(axis=2) <= 12)
    # quita componentes de fondo conectadas al borde
    labels, n = ndimage.label(near)
    border_labels = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    border_labels.discard(0)
    bg = np.isin(labels, list(border_labels))
    out = np.dstack([arr, np.where(bg, 0, 255)]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def sheet(name):
    if name not in cache:
        im = Image.open(os.path.join(SRC, f'{name}.png'))
        cache[name] = dechecker(im)
    return cache[name]

def n_tile(name, x, y):
    return sheet(name).crop((x, y, x + T, y + T))

def make_grass(seed):
    """Genera un tile de césped 32x32 seamless, con dithering sutil y matas."""
    rng = random.Random(seed)
    base = GRASS_PALETTE['base']
    dark = GRASS_PALETTE['dark']
    light = GRASS_PALETTE['light']
    tuft = GRASS_PALETTE['tuft']
    im = Image.new('RGBA', (T, T), base)
    px = im.load()
    # dithering muy sutil tipo tablero (disperso) para no ensuciar
    for y in range(T):
        for x in range(T):
            if (x + y) % 4 == 0 and x % 2 == 0:
                px[x, y] = dark
            elif (x - y) % 4 == 0 and x % 2 == 1:
                px[x, y] = light
    # matas de hierba
    for _ in range(7):
        x = rng.randrange(2, T - 2)
        y = rng.randrange(3, T - 1)
        px[x, y] = tuft
        px[x, y - 1] = tuft
        px[x + 1, y] = tuft
        if rng.random() < 0.5:
            px[x, y - 2] = tuft
    return im


def main():
    os.makedirs(OUT, exist_ok=True)

    cells = []
    grid = {}
    idx = 0
    col = row = 0

    def place(im, start_row=False):
        nonlocal idx, col, row
        if start_row and col != 0:
            row += 1
            col = 0
        if col >= COLS:
            col = 0
            row += 1
        grid[(col, row)] = idx
        cells.append(im)
        col += 1
        idx += 1

    manifest_singles = {}
    # césped procedural primero
    for n in ('grass', 'grass2', 'grass3'):
        place(make_grass(n))
        manifest_singles[n] = idx - 1
    # resto de singles
    for n, (sh, x, y) in SINGLES.items():
        place(n_tile(sh, x, y))
        manifest_singles[n] = idx - 1

    manifest_blocks = {}
    for b, (sh, bx, by, w, h) in BLOCKS.items():
        region = sheet(sh).crop((bx, by, bx + w * T, by + h * T))
        bbox = region.getchannel('A').getbbox() or (0, 0, w * T, h * T)
        x0 = (bbox[0] // T) * T
        y0 = (bbox[1] // T) * T
        x1 = ((bbox[2] + T - 1) // T) * T
        y1 = ((bbox[3] + T - 1) // T) * T
        nw, nh = (x1 - x0) // T, (y1 - y0) // T
        start = idx
        for r in range(nh):
            for c in range(nw):
                place(n_tile(sh, bx + x0 + c * T, by + y0 + r * T))
        manifest_blocks[b] = {'start': start, 'w': nw, 'h': nh, 'stride': COLS}

    width = COLS * T
    height = ((idx + COLS - 1) // COLS) * T
    atlas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    for (c, r), i in grid.items():
        atlas.paste(cells[i], (c * T, r * T))
    atlas.save(os.path.join(OUT, 'outdoor.png'))

    manifest = {'tileSize': T, 'columns': COLS, 'tiles': manifest_singles, 'blocks': manifest_blocks}
    with open(os.path.join(OUT, 'outdoor.json'), 'w') as f:
        json.dump(manifest, f, indent=2)

    tsj = {
        'name': 'magiscarf-outdoor',
        'image': 'outdoor.png',
        'imagewidth': width,
        'imageheight': height,
        'tilewidth': T,
        'tileheight': T,
        'tilecount': idx,
        'columns': COLS,
        'margin': 0,
        'spacing': 0,
    }
    with open(os.path.join(OUT, 'outdoor.tsj'), 'w') as f:
        json.dump(tsj, f, indent=2)

    print(f'✔ outdoor.png {width}x{height}  tiles={idx} columns={COLS}')
    print('  singles:', manifest_singles)
    print('  blocks :', manifest_blocks)


if __name__ == '__main__':
    main()
