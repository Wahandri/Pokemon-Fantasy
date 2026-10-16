#!/usr/bin/env python3
"""
Convierte los mapas Tiled (.tmx) de Pokémon Uranium a formato Phaser (.tmj).

- Construye UN atlas global con los 7 tilesets (public/tilesets/uranium/tilesets.png).
- Limpia los marcadores rojos y deduce la colisión por color del mapa compuesto.
- Emite public/maps/<id>.tmj y public/maps/<id>.json.
- Previsualización en /tmp/opencode/prev/ur_<id>.png
"""
import json
import os
import re
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '.assets-src', 'uranium')
OUT_TS = os.path.join(ROOT, 'public', 'tilesets', 'uranium')
OUT_MAPS = os.path.join(ROOT, 'public', 'maps')
PREV = '/tmp/opencode/prev'
T = 16

TSX = ['PU_groundtiles+', 'PU_buildings+', 'PU_watertiles+', 'PU_autotiles',
       'PU_anim_tiles', 'PU_caves', 'PU_indoors+']

# conexiones entre mapas (bordes alcanzables -> mapa destino)
LINKS = {
    'moki': {'up': 'route3', 'down': 'route1'},
    'route1': {'up': 'moki', 'down': 'route2'},
    'route2': {'up': 'route1', 'down': 'nowtoch'},
    'route3': {'down': 'moki', 'left': 'nowtoch'},
    'nowtoch': {'up': 'route2', 'down': 'kevlar'},
    'kevlar': {'up': 'nowtoch', 'down': 'burole'},
    'burole': {'up': 'kevlar'},
}

# Pokémon salvajes por ruta (especies 1-150 del juego)
WILD = {
    'route1': {'rate': 0.13, 'table': [
        {'num': 10, 'min': 2, 'max': 5}, {'num': 13, 'min': 2, 'max': 5},
        {'num': 16, 'min': 2, 'max': 6}, {'num': 19, 'min': 3, 'max': 6},
        {'num': 25, 'min': 3, 'max': 5}]},
    'route2': {'rate': 0.13, 'table': [
        {'num': 21, 'min': 4, 'max': 8}, {'num': 27, 'min': 4, 'max': 7},
        {'num': 32, 'min': 4, 'max': 8}, {'num': 37, 'min': 5, 'max': 8},
        {'num': 41, 'min': 5, 'max': 8}]},
    'route3': {'rate': 0.14, 'table': [
        {'num': 43, 'min': 6, 'max': 11}, {'num': 60, 'min': 6, 'max': 10},
        {'num': 69, 'min': 6, 'max': 10}, {'num': 74, 'min': 7, 'max': 11},
        {'num': 133, 'min': 8, 'max': 12}]},
    'burole': {'rate': 0.13, 'table': [
        {'num': 29, 'min': 5, 'max': 9}, {'num': 32, 'min': 5, 'max': 9},
        {'num': 56, 'min': 6, 'max': 10}, {'num': 66, 'min': 6, 'max': 10}]},
    'kevlar': {'rate': 0.13, 'table': [
        {'num': 23, 'min': 5, 'max': 9}, {'num': 27, 'min': 5, 'max': 9},
        {'num': 58, 'min': 7, 'max': 11}]},
}


def load_def(name):
    ts = ET.parse(os.path.join(SRC, f'tilesets__{name}.tsx')).getroot()
    img = ts.find('image').get('source')
    return {'name': name, 'png': os.path.join(SRC, 'tilesets__' + img),
            'columns': int(ts.get('columns')), 'tilecount': int(ts.get('tilecount'))}


def build_global_atlas():
    defs = {n: load_def(n) for n in TSX}
    ims = []
    y = 0
    for n in TSX:
        d = defs[n]
        im = Image.open(d['png']).convert('RGBA')
        d['_y'] = y
        d['_h'] = im.height
        ims.append(im)
        y += im.height
    W = max(im.width for im in ims)
    atlas = Image.new('RGBA', (W, y), (0, 0, 0, 0))
    yy = 0
    for n in TSX:
        d = defs[n]
        im = ims[TSX.index(n)]
        # limpia marcadores rojos
        px = im.load()
        for py in range(im.height):
            for pxx in range(im.width):
                r, g, b, a = px[pxx, py]
                if a > 100 and r > 180 and g < 80 and b < 80:
                    px[pxx, py] = (0, 0, 0, 0)
        atlas.paste(im, (0, yy))
        yy += im.height
    os.makedirs(OUT_TS, exist_ok=True)
    atlas.save(os.path.join(OUT_TS, 'tilesets.png'))
    return defs, atlas


def atlas_index(defs, atlas, name, lid):
    d = defs[name]
    cols = atlas.width // T
    row = d['_y'] // T + lid // d['columns']
    col = lid % d['columns']
    return row * cols + col


def parse_tmx(path):
    root = ET.parse(path).getroot()
    W, H = int(root.get('width')), int(root.get('height'))
    refs = []
    for ts in root.findall('tileset'):
        src = ts.get('source')
        nm = os.path.basename(src).replace('.tsx', '')
        refs.append({'firstgid': int(ts.get('firstgid')), 'name': nm})
    refs.sort(key=lambda r: r['firstgid'])
    layers = []
    for lay in root.findall('layer'):
        data = lay.find('data')
        if data.get('encoding') != 'csv':
            continue
        nums = [int(x) for x in re.findall(r'-?\d+', data.text)]
        layers.append(nums)
    return W, H, refs, layers


def ts_of(refs, gid):
    r = refs[0]
    for x in refs:
        if gid >= x['firstgid']:
            r = x
    return r


def convert(tmx_file, map_id, name, defs, atlas, npcs=None):
    W, H, refs, layers = parse_tmx(os.path.join(SRC, tmx_file))
    cols = atlas.width // T
    firstgid = 1
    out_layers = []
    src_name = [[None] * W for _ in range(H)]
    for data in layers:
        out = []
        for i, g in enumerate(data):
            if g == 0:
                out.append(0)
            else:
                r = ts_of(refs, g)
                out.append(atlas_index(defs, atlas, r['name'], g - r['firstgid']) + firstgid)
                src_name[i // W][i % W] = r['name']
        out_layers.append(out)

    # composición para colisión y preview
    canvas = Image.new('RGBA', (W * T, H * T), (0, 0, 0, 0))
    for out in out_layers:
        for i, g in enumerate(out):
            if not g:
                continue
            idx = g - firstgid
            cx, cy = (idx % cols) * T, (idx // cols) * T
            canvas.alpha_composite(atlas.crop((cx, cy, cx + T, cy + T)), ((i % W) * T, (i // W) * T))

    collision = [[0] * W for _ in range(H)]
    enc = [[0] * W for _ in range(H)]
    px = canvas.load()
    SOLID_TS = {'PU_buildings+', 'PU_watertiles+', 'PU_caves'}
    has_wild = map_id in WILD
    for y in range(H):
        for x in range(W):
            r = g = b = n = 0
            for yy in range(y * T, y * T + T, 2):
                for xx in range(x * T, x * T + T, 2):
                    pr, pg, pb, pa = px[xx, yy]
                    if pa < 60:
                        continue
                    r += pr; g += pg; b += pb; n += 1
            if n == 0:
                collision[y][x] = 1
                continue
            r //= n; g //= n; b //= n
            mx, mn = max(r, g, b), min(r, g, b)
            solid = False
            if b > r + 15 and b > g + 5:
                solid = True
            elif g > r + 25 and g > b + 25 and g < 175:
                solid = True
            elif src_name[y][x] in SOLID_TS:
                solid = True
            elif (mx - mn) < 45 and (r + g + b) / 3 > 135:
                solid = True
            collision[y][x] = 1 if solid else 0
            # hierba alta: verde y transitable en mapas con Pokémon salvajes
            if has_wild and not solid and g > r + 12 and g > b + 12 and g > 120:
                enc[y][x] = 1

    # la hierba alta NUNCA bloquea
    for y in range(H):
        for x in range(W):
            if enc[y][x]:
                collision[y][x] = 0

    # warps: celdas de borde alcanzables desde el centro (flood fill)
    warps = []
    if map_id in LINKS:
        from collections import deque
        sx, sy = W // 2, H // 2
        if collision[sy][sx]:
            for r in range(1, 25):
                found = False
                for dy in range(-r, r + 1):
                    for dx in range(-r, r + 1):
                        if 0 <= sx + dx < W and 0 <= sy + dy < H and not collision[sy + dy][sx + dx]:
                            sx, sy = sx + dx, sy + dy; found = True; break
                    if found: break
                if found: break
        seen = [[False] * W for _ in range(H)]
        q = deque([(sx, sy)]); seen[sy][sx] = True
        border = []
        while q:
            x, y = q.popleft()
            if x in (0, W - 1) or y in (0, H - 1):
                border.append((x, y))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and not seen[ny][nx] and not collision[ny][nx]:
                    seen[ny][nx] = True; q.append((nx, ny))
        for d, dest in LINKS[map_id].items():
            cand = []
            for (x, y) in border:
                if d == 'up' and y == 0: cand.append((x, y))
                elif d == 'down' and y == H - 1: cand.append((x, y))
                elif d == 'left' and x == 0: cand.append((x, y))
                elif d == 'right' and x == W - 1: cand.append((x, y))
            # el más cercano al centro
            cand.sort(key=lambda p: abs(p[0] - sx) + abs(p[1] - sy))
            for (x, y) in cand[:3]:
                warps.append({'x': x, 'y': y, 'dest': dest})

    # capa de hierba alta visible (matas de PU_anim_tiles) en las zonas de encuentro
    tuft = [atlas_index(defs, atlas, 'PU_anim_tiles', 36 + i) + firstgid for i in range(4)]
    overlay = [0] * (W * H)
    for y in range(H):
        for x in range(W):
            if enc[y][x] and not collision[y][x]:
                overlay[y * W + x] = tuft[(x * 3 + y * 5) % 4]
    if any(overlay):
        out_layers.append(overlay)

    tileset_obj = {'firstgid': firstgid, 'name': 'uranium',
                   'image': '../tilesets/uranium/tilesets.png',
                   'imagewidth': atlas.width, 'imageheight': atlas.height,
                   'tilewidth': T, 'tileheight': T,
                   'tilecount': (atlas.width // T) * (atlas.height // T),
                   'columns': cols, 'margin': 0, 'spacing': 0}
    tj = [{'id': i + 1, 'name': f'layer{i + 1}', 'type': 'tilelayer', 'x': 0, 'y': 0,
           'width': W, 'height': H, 'opacity': 1, 'visible': True, 'data': d}
          for i, d in enumerate(out_layers)]
    tmj = {'compressionlevel': -1, 'height': H, 'width': W, 'infinite': False,
           'orientation': 'orthogonal', 'renderorder': 'right-down',
           'tiledversion': '1.10.2', 'type': 'map', 'version': '1.10',
           'tilewidth': T, 'tileheight': T, 'nextlayerid': len(tj) + 1, 'nextobjectid': 1,
           'tilesets': [tileset_obj], 'layers': tj}
    os.makedirs(OUT_MAPS, exist_ok=True)
    json.dump(tmj, open(os.path.join(OUT_MAPS, f'{map_id}.tmj'), 'w'))

    side = {'id': map_id, 'name': name, 'width': W, 'height': H, 'tile': T,
            'collision': collision, 'encounters': enc,
            'npcs': [], 'warps': warps, 'spawn': {'x': W // 2, 'y': H // 2}}
    if map_id in WILD:
        side['wild'] = WILD[map_id]
    json.dump(side, open(os.path.join(OUT_MAPS, f'{map_id}.json'), 'w'))

    os.makedirs(PREV, exist_ok=True)
    canvas.convert('RGB').save(os.path.join(PREV, f'ur_{map_id}.png'))
    print(f'✔ {map_id}: {W}x{H}  sólidos={sum(sum(r) for r in collision)}')


JOBS = [
    ('MokiTown__Moki Town.tmx', 'moki', 'Moki Town'),
    ('Routes__Route1__Route1.tmx', 'route1', 'Route 1'),
    ('Routes__Route2__Route 2.tmx', 'route2', 'Route 2'),
    ('Routes__Route3__Route 3.tmx', 'route3', 'Route 3'),
    ('NowtochCity__Nowtoch City.tmx', 'nowtoch', 'Nowtoch City'),
    ('KevlarTown__Kevlar Town.tmx', 'kevlar', 'Kevlar Town'),
    ('BuroleTown__Burole Town.tmx', 'burole', 'Burole Town'),
]

if __name__ == '__main__':
    defs, atlas = build_global_atlas()
    print(f'atlas global {atlas.width}x{atlas.height}')
    for f, mid, nm in JOBS:
        p = os.path.join(SRC, f)
        if os.path.exists(p):
            convert(f, mid, nm, defs, atlas)
        else:
            print('falta', f)
