#!/usr/bin/env python3
"""
Autotiles de RPG Maker XP (formato 96x128 = 3x4 tiles).

Expande un autotile RMXP a sus 48 formas (rejilla 8x6) usando la tabla de
cuadrantes oficial. Además traduce el vecindario (8 direcciones) al índice de
forma 0..47 para poder autotilear al construir los mapas.

La tabla RMXP_CASES y la expansión provienen del formato RMXP (3x4 tiles de
32px, divididos internamente en 6x8 subtiles de 16px).
"""
from PIL import Image

TILE = 32
SUB = TILE // 2
SRC_COLS_SUB = 6

# 48 formas: cada una define los 4 subtiles [TL, TR, BL, BR] (índices 0..47 del
# rejilla de subtiles 6x8).
RMXP_CASES = [
    [26, 27, 32, 33], [4, 27, 32, 33], [26, 5, 32, 33], [4, 5, 32, 33],
    [26, 27, 32, 11], [4, 27, 32, 11], [26, 5, 32, 11], [4, 5, 32, 11],
    [26, 27, 10, 33], [4, 27, 10, 33], [26, 5, 10, 33], [4, 5, 10, 33],
    [26, 27, 10, 11], [4, 27, 10, 11], [26, 5, 10, 11], [4, 5, 10, 11],
    [24, 25, 30, 31], [24, 5, 30, 31], [24, 25, 30, 11], [24, 5, 30, 11],
    [14, 15, 20, 21], [14, 15, 20, 11], [14, 15, 10, 21], [14, 15, 10, 11],
    [28, 29, 34, 35], [28, 29, 10, 35], [4, 29, 34, 35], [4, 29, 10, 35],
    [26, 27, 44, 45], [4, 39, 44, 45], [38, 5, 44, 45], [4, 5, 44, 45],
    [24, 29, 30, 35], [14, 15, 44, 45], [12, 13, 18, 19], [12, 13, 18, 11],
    [16, 17, 22, 23], [16, 17, 10, 23], [40, 41, 46, 47], [4, 41, 46, 47],
    [36, 37, 42, 43], [36, 5, 42, 43], [12, 17, 18, 23], [12, 13, 42, 43],
    [36, 41, 42, 47], [16, 17, 46, 47], [12, 17, 42, 47], [12, 17, 42, 47],
]

# Vecindario (8 direcciones, bit a bit) -> índice de forma 0..47
# bits: 1=N, 2=E, 4=S, 8=W, 16=NE, 32=SE, 64=SW, 128=NW
MASK_TO_SHAPE = {}


def _subtile_box(index):
    return ((index % SRC_COLS_SUB) * SUB, (index // SRC_COLS_SUB) * SUB,
            (index % SRC_COLS_SUB) * SUB + SUB, (index // SRC_COLS_SUB) * SUB + SUB)


def expand_autotile(path_or_img):
    """Devuelve una imagen 8x6 (256x192) con las 48 formas del autotile."""
    im = path_or_img if isinstance(path_or_img, Image.Image) else Image.open(path_or_img)
    im = im.convert('RGBA')
    out = Image.new('RGBA', (TILE * 8, TILE * 6), (0, 0, 0, 0))
    for sid, case in enumerate(RMXP_CASES):
        ox, oy = (sid % 8) * TILE, (sid // 8) * TILE
        for qi, sub in enumerate(case):
            sx, sy, ex, ey = _subtile_box(sub)
            piece = im.crop((sx, sy, ex, ey))
            px = (qi % 2) * SUB
            py = (qi // 2) * SUB
            out.alpha_composite(piece, (ox + px, oy + py))
    return out


def shape_for(n, e, s, w, ne, se, sw, nw):
    """Índice de forma 0..47 a partir de la conectividad del vecindario."""
    return MASK_TO_SHAPE[_mask(n, e, s, w, ne, se, sw, nw)]


def _mask(n, e, s, w, ne, se, sw, nw):
    return (n and 1 or 0) | (e and 2 or 0) | (s and 4 or 0) | (w and 8 or 0) \
        | (ne and 16 or 0) | (se and 32 or 0) | (sw and 64 or 0) | (nw and 128 or 0)
