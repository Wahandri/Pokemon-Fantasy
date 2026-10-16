#!/usr/bin/env python3
"""Previsualiza los tiles del manifest con su nombre, para verificar coordenadas.
Uso: tools/tiles-preview.py [manifest.json] [out.png]
"""
import json, os, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
man_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'public/tilesets/magiscarf/outdoor.json')
atlas_path = os.path.join(os.path.dirname(man_path), 'outdoor.png')
out = sys.argv[2] if len(sys.argv) > 2 else '/tmp/opencode/prev/atlas_labeled.png'

man = json.load(open(man_path))
atlas = Image.open(atlas_path).convert('RGBA')
T = man['tileSize']
COLS = man['columns']
w, h = atlas.size
rows = h // T

SCALE = 3
CELL = T * SCALE
label_h = 12
sheet = Image.new('RGB', (COLS * CELL, rows * (CELL + label_h)), (245, 245, 245))
d = ImageDraw.Draw(sheet)
# transparencia como cuadros
for r in range(rows):
    for c in range(COLS):
        X, Y = c * CELL, r * (CELL + label_h)
        for yy in range(0, CELL, 16):
            for xx in range(0, CELL, 16):
                if ((xx // 16) + (yy // 16)) % 2:
                    d.rectangle([X + xx, Y + yy, X + xx + 15, Y + yy + 15], fill=(214, 214, 219))
        tile = atlas.crop((c * T, r * T, c * T + T, r * T + T)).resize((CELL, CELL), Image.NEAREST)
        sheet.paste(tile, (X, Y), tile)
        d.rectangle([X, Y, X + CELL, Y + CELL], outline=(120, 120, 130))
        d.text((X + 2, Y + CELL + 1), f'{r},{c}', fill=(150, 0, 0))

# etiquetas de nombre de los singles
inv = {v: k for k, v in man['tiles'].items()}
for name, i in man['tiles'].items():
    r, c = divmod(i, COLS)
    d.text((c * CELL + CELL + 1, r * (CELL + label_h) + 2), name, fill=(0, 90, 0))
for name, b in man['blocks'].items():
    r, c = divmod(b['start'], COLS)
    d.text((c * CELL + CELL + 1, r * (CELL + label_h) + 2), name, fill=(0, 0, 150))

sheet.save(out)
print(out, sheet.size)
