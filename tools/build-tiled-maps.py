#!/usr/bin/env python3
"""
Genera mapas Tiled (.tmj) a partir de los datos actuales de public/maps/*.json
(colisión y encuentros reales) clasificando cada celda por terreno:

  tallgrass -> encounters==1
  agua      -> colisión y color azul
  árbol     -> colisión y color verde
  edificio  -> colisión y color no verde/azul  (se agrupan en "blocks" de casa)
  camino    -> transitable y color claro
  césped    -> resto

Salidas:
  public/maps/<id>.tmj          (mapa Tiled, tileset embebido, agua animada)
  /tmp/opencode/prev/map_<id>.png (previsualización renderizada para revisar)
"""
import json
import os
import struct
import sys
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPS = os.path.join(ROOT, 'public', 'maps')
DECOMP = os.path.join(ROOT, '.decomp')
TS_Dir = os.path.join(ROOT, 'public', 'tilesets', 'magiscarf')
MAN = json.load(open(os.path.join(TS_Dir, 'outdoor.json')))
ATLAS = Image.open(os.path.join(TS_Dir, 'outdoor.png')).convert('RGBA')
T = MAN['tileSize']
COLS = MAN['columns']
TILE_NAMES = MAN['tiles']
BLOCKS = MAN['blocks']

# mapa corto -> carpeta del decomp
DECOMP_DIR = {'littleroot': 'LittlerootTown', 'route101': 'Route101',
              'oldale': 'OldaleTown', 'route102': 'Route102'}

METATILE_MASK = 0x03FF
COLLISION_MASK = 0x0C00
NUM_METATILES_IN_PRIMARY = 512
GRASS_BEHAVIORS = {2, 3, 7}
WATER_BEHAVIORS = set(range(16, 27))

_role_cache = {}

def pokeemerald_roles(map_id):
    """Devuelve rejilla de roles por behavior real del decomp:
    0=césped, 1=hierba alta, 2=agua, 3=bloqueado. None si no hay decomp."""
    if map_id in _role_cache:
        return _role_cache[map_id]
    try:
        layouts = {l['id']: l for l in json.load(open(os.path.join(DECOMP, 'data/layouts/layouts.json')))['layouts']}
        mj = json.load(open(os.path.join(DECOMP, f'data/maps/{DECOMP_DIR[map_id]}/map.json')))
        layout = layouts[mj['layout']]
        w, h = layout['width'], layout['height']
        blockdata = open(os.path.join(DECOMP, layout['blockdata_filepath']), 'rb').read()

        def load_attrs(folder):
            raw = open(os.path.join(DECOMP, f'data/tilesets/{folder}/metatile_attributes.bin'), 'rb').read()
            return [struct.unpack_from('<H', raw, i * 2)[0] for i in range(len(raw) // 2)]

        pri = load_attrs('primary/general')
        sec = load_attrs('secondary/petalburg')
        roles = [[0] * w for _ in range(h)]
        for by in range(h):
            for bx in range(w):
                block = struct.unpack_from('<H', blockdata, (by * w + bx) * 2)[0]
                mt = block & METATILE_MASK
                if mt < NUM_METATILES_IN_PRIMARY:
                    attr = pri[mt] if mt < len(pri) else 0
                else:
                    mi = mt - NUM_METATILES_IN_PRIMARY
                    attr = sec[mi] if mi < len(sec) else 0
                beh = attr & 0xFF
                if beh in GRASS_BEHAVIORS:
                    roles[by][bx] = 1
                elif beh in WATER_BEHAVIORS:
                    roles[by][bx] = 2
                elif block & COLLISION_MASK:
                    roles[by][bx] = 3
                else:
                    roles[by][bx] = 0
        _role_cache[map_id] = roles
        return roles
    except Exception as e:
        print(f'  (aviso: sin roles del decomp para {map_id}: {e})')
        _role_cache[map_id] = None
        return None

FIRSTGID = 1
def gid(name):
    return TILE_NAMES[name] + FIRSTGID

# --- Clasificación de color ---
def avg_color(im, tx, ty, tile_px):
    box = (tx * tile_px, ty * tile_px, tx * tile_px + tile_px, ty * tile_px + tile_px)
    region = im.crop(box).convert('RGBA')
    px = region.getdata()
    n = 0; r = g = b = a = 0
    for pr, pg, pb, pa in px:
        if pa < 40:
            continue
        r += pr; g += pg; b += pb; a += pa; n += 1
    if n == 0:
        return None
    return (r // n, g // n, b // n)


def is_blue(c):
    r, g, b = c
    return b > r + 12 and b > g + 8 and b > 90


def is_green(c):
    r, g, b = c
    return g > r + 10 and g > b + 10


def brightness(c):
    return (c[0] + c[1] + c[2]) / 3


def classify(map_id, collision, encounters, W, H, roles):
    base = Image.open(os.path.join(MAPS, f'{map_id}.png')).convert('RGBA')
    top = Image.open(os.path.join(MAPS, f'{map_id}_top.png')).convert('RGBA')
    terrain = [[0] * W for _ in range(H)]
    blue_cells = []
    for ty in range(H):
        for tx in range(W):
            c = collision[ty][tx]
            e = encounters[ty][tx]
            # roles reales del decomp (agua / hierba alta) tienen prioridad
            if roles is not None:
                if roles[ty][tx] == 1:
                    terrain[ty][tx] = 'tallgrass'; continue
                if roles[ty][tx] == 2:
                    terrain[ty][tx] = 'water'; continue
            if e:
                terrain[ty][tx] = 'tallgrass'
                continue
            if c:
                col = avg_color(top, tx, ty, 16)
                if col is None or is_green(col):
                    bcol = avg_color(base, tx, ty, 16)
                    col = bcol if (bcol and not is_green(bcol)) else (col or bcol or (0, 0, 0))
                if col is None:
                    terrain[ty][tx] = 'tree'
                elif is_blue(col):
                    if roles is not None:
                        terrain[ty][tx] = 'building'
                    else:
                        terrain[ty][tx] = 'water?'; blue_cells.append((tx, ty))
                elif is_green(col):
                    terrain[ty][tx] = 'tree'
                else:
                    terrain[ty][tx] = 'building'
            else:
                col = avg_color(base, tx, ty, 16) or (90, 176, 74)
                if brightness(col) > 175 and is_green(col):
                    terrain[ty][tx] = 'path?'
                else:
                    terrain[ty][tx] = 'grass'

    # suavizado de caminos: solo cuenta como camino si la mayoría del entorno lo es
    for ty in range(H):
        for tx in range(W):
            if terrain[ty][tx] != 'path?':
                continue
            pale = 0; tot = 0
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nx, ny = tx + dx, ty + dy
                    if 0 <= nx < W and 0 <= ny < H and terrain[ny][nx] in ('path?', 'path'):
                        pale += 1
                    tot += 1
            terrain[ty][tx] = 'path' if pale >= 6 else 'grass'
    for ty in range(H):
        for tx in range(W):
            if terrain[ty][tx] == 'path?':
                terrain[ty][tx] = 'grass'

    # fallback sin decomp: los "water?" grandes son agua; los pequeños (ventanas) edificios
    seen = set()
    for (sx, sy) in blue_cells:
        if (sx, sy) in seen:
            continue
        q = deque([(sx, sy)]); seen.add((sx, sy))
        comp = []
        while q:
            x, y = q.popleft(); comp.append((x, y))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if (nx, ny) in blue_cells and (nx, ny) not in seen:
                    seen.add((nx, ny)); q.append((nx, ny))
        kind = 'water' if len(comp) >= 5 else 'building'
        for (x, y) in comp:
            terrain[y][x] = kind
    return terrain


def find_buildings(terrain, W, H):
    """Componentes conexas de celdas 'building' -> bloque de casa por tamaño."""
    seen = [[False] * W for _ in range(H)]
    comps = []
    for ty in range(H):
        for tx in range(W):
            if terrain[ty][tx] != 'building' or seen[ty][tx]:
                continue
            q = deque([(tx, ty)]); seen[ty][tx] = True
            cells = []
            while q:
                x, y = q.popleft(); cells.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny][nx] and terrain[ny][nx] == 'building':
                        seen[ny][nx] = True; q.append((nx, ny))
            xs = [c[0] for c in cells]; ys = [c[1] for c in cells]
            comps.append((min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1, len(cells)))
    return comps


def hname(x, y):
    """hash estable para variar tiles."""
    return (x * 73856093) ^ (y * 19349663)


def build_map(map_id):
    data = json.load(open(os.path.join(MAPS, f'{map_id}.json')))
    W, H = data['width'], data['height']
    collision, encounters = data['collision'], data['encounters']
    terrain = classify(map_id, collision, encounters, W, H, pokeemerald_roles(map_id))

    layer = [0] * (W * H)          # detalles (transparentes dejan ver el césped)
    base = [0] * (W * H)           # césped de relleno
    def set_tile(x, y, name):
        if 0 <= x < W and 0 <= y < H:
            layer[y * W + x] = gid(name) if name in TILE_NAMES else name

    # 0) base de césped en TODAS las celdas (las transparencias muestran esto)
    for y in range(H):
        for x in range(W):
            h = hname(x, y)
            base[y * W + x] = gid('grass' if h % 5 else ('grass2' if h % 2 else 'grass3'))

    # 1) caminos
    for y in range(H):
        for x in range(W):
            if terrain[y][x] == 'path':
                set_tile(x, y, 'path')

    # 3) agua
    for y in range(H):
        for x in range(W):
            if terrain[y][x] == 'water':
                set_tile(x, y, 'water')

    # 4) hierba alta (patrón 2x2 continuo)
    TG = {('0', '0'): 'tallgrass', ('1', '0'): 'tallgrass2',
          ('0', '1'): 'tallgrass3', ('1', '1'): 'tallgrass4'}
    for y in range(H):
        for x in range(W):
            if terrain[y][x] == 'tallgrass':
                set_tile(x, y, TG[(str(x % 2), str(y % 2))])

    # 5) casas (blocks) sobre los edificios detectados
    placed = [[False] * W for _ in range(H)]
    for (bx, by, bw, bh, n) in sorted(find_buildings(terrain, W, H), key=lambda c: -c[4]):
        # casa si es un bloque grande y más o menos homogéneo; si no -> valla
        if bw >= 4 and bh >= 3:
            b = 'house1'
        elif bw >= 3 and bh >= 3:
            b = 'house2'
        else:
            for yy in range(by, by + bh):
                for xx in range(bx, bx + bw):
                    set_tile(xx, yy, 'fence')
                    placed[yy][xx] = True
            continue
        info = BLOCKS[b]
        w, h = info['w'], info['h']
        ox = bx + max(0, (bw - w) // 2) - (0 if bw >= w else 0)
        oy = by + max(0, (bh - h) // 2)
        ox = min(max(0, ox), W - w)
        oy = min(max(0, oy), H - h)
        start = info['start']
        for r in range(h):
            for c in range(w):
                set_tile(ox + c, oy + r, f'__block__:{start + r * w + c}')
                placed[oy + r][ox + c] = True

    # 6) árboles (2 de alto) sobre bordes y celdas 'tree'
    for y in range(H):
        for x in range(W):
            if placed[y][x]:
                continue
            if terrain[y][x] == 'tree':
                kind = hname(x, y) % 3
                top = ['tree_top', 'tree2_top', 'pine_top'][kind]
                bot = ['tree_bot', 'tree2_bot', 'pine_bot'][kind]
                set_tile(x, y, bot)
                if y - 1 >= 0 and not placed[y - 1][x] and terrain[y - 1][x] in ('grass', 'path'):
                    set_tile(x, y - 1, top)

    # resolver placeholders __block__:NN
    final = []
    for v in layer:
        if isinstance(v, str) and v.startswith('__block__:'):
            final.append(int(v.split(':')[1]) + FIRSTGID)
        else:
            final.append(v)

    # --- tmj ---
    embedded = {
        'firstgid': FIRSTGID,
        'name': 'magiscarf-outdoor',
        'image': '../tilesets/magiscarf/outdoor.png',
        'imagewidth': ATLAS.width,
        'imageheight': ATLAS.height,
        'tilewidth': T,
        'tileheight': T,
        'tilecount': (ATLAS.width // T) * (ATLAS.height // T),
        'columns': COLS,
        'margin': 0,
        'spacing': 0,
        'tiles': [
            {'id': TILE_NAMES['water'],
             'animation': [
                 {'duration': 350, 'tileid': TILE_NAMES['water2']},
                 {'duration': 350, 'tileid': TILE_NAMES['water3']},
             ]},
        ],
    }
    tmj = {
        'compressionlevel': -1,
        'height': H,
        'width': W,
        'infinite': False,
        'orientation': 'orthogonal',
        'renderorder': 'right-down',
        'tiledversion': '1.10.2',
        'type': 'map',
        'version': '1.10',
        'tilewidth': T,
        'tileheight': T,
        'nextlayerid': 2,
        'nextobjectid': 1,
        'tilesets': [embedded],
        'layers': [
            {'id': 1, 'name': 'base', 'type': 'tilelayer', 'x': 0, 'y': 0,
             'width': W, 'height': H, 'opacity': 1, 'visible': True, 'data': base},
            {'id': 2, 'name': 'ground', 'type': 'tilelayer', 'x': 0, 'y': 0,
             'width': W, 'height': H, 'opacity': 1, 'visible': True, 'data': final},
        ],
    }
    out_tmj = os.path.join(MAPS, f'{map_id}.tmj')
    with open(out_tmj, 'w') as f:
        json.dump(tmj, f)

    # --- preview ---
    canvas = Image.new('RGBA', (W * T, H * T), (0, 0, 0, 0))

    def blit(g, x, y):
        if not g:
            return
        i = g - FIRSTGID
        c, r = i % COLS, i // COLS
        canvas.alpha_composite(ATLAS.crop((c * T, r * T, c * T + T, r * T + T)), (x * T, y * T))

    for y in range(H):
        for x in range(W):
            blit(base[y * W + x], x, y)
    for y in range(H):
        for x in range(W):
            blit(final[y * W + x], x, y)
    os.makedirs('/tmp/opencode/prev', exist_ok=True)
    canvas.convert('RGB').save(f'/tmp/opencode/prev/map_{map_id}.png')
    print(f'✔ {map_id}: {W}x{H}  tmj={out_tmj}  preview=map_{map_id}.png')


if __name__ == '__main__':
    ids = sys.argv[1:] or ['littleroot', 'route101', 'oldale', 'route102']
    for i in ids:
        build_map(i)
