#!/usr/bin/env python3
"""Recorta una región de un tileset, la amplía y dibuja una rejilla de 32px
con coordenadas (en tiles) para identificar tiles exactos.

Uso: tools/crop-grid.py <png> <x0> <y0> <x1> <y1> <zoom> [out.png]
Coordenadas en PÍXELES del PNG original.
"""
import sys
from PIL import Image, ImageDraw

TILE = 32

def main():
    src, x0, y0, x1, y1, zoom = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6])
    out = sys.argv[7] if len(sys.argv) > 7 else '/tmp/opencode/prev/crop.png'
    im = Image.open(src).convert('RGBA')
    crop = im.crop((x0, y0, x1, y1))
    w, h = crop.size
    # fondo a cuadros para ver transparencia
    bg = Image.new('RGBA', (w, h), (255, 255, 255, 255))
    for yy in range(0, h, 16):
        for xx in range(0, w, 16):
            if ((xx // 16) + (yy // 16)) % 2:
                bg.paste((210, 210, 215, 255), (xx, yy, min(xx + 16, w), min(yy + 16, h)))
    bg.alpha_composite(crop)
    crop = bg
    crop = crop.resize((w * zoom, h * zoom), Image.NEAREST)
    d = ImageDraw.Draw(crop)
    # grid en tiles (32px originales)
    for gx in range(0, w + 1, TILE):
        X = gx * zoom
        col = (255, 0, 0, 200) if (x0 + gx) % (TILE * 5) == 0 else (0, 0, 255, 90)
        d.line([(X, 0), (X, crop.height)], fill=col, width=1)
        if (x0 + gx) % TILE == 0:
            d.text((X + 2, 2), str((x0 + gx) // TILE), fill=(200, 0, 0))
    for gy in range(0, h + 1, TILE):
        Y = gy * zoom
        col = (255, 0, 0, 200) if (y0 + gy) % (TILE * 5) == 0 else (0, 0, 255, 90)
        d.line([(0, Y), (crop.width, Y)], fill=col, width=1)
        d.text((2, Y + 2), str((y0 + gy) // TILE), fill=(200, 0, 0))
    crop.save(out)
    print(f'{out}  ({out and w*zoom}x{h*zoom})  tiles x={(x0)//TILE}..{(x1)//TILE} y={(y0)//TILE}..{(y1)//TILE}')

if __name__ == '__main__':
    main()
