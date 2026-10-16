#!/usr/bin/env python3
"""
Descarga los assets de Pokémon Uranium (tilesets + mapas Tiled) desde el repo
MIT acedogblast/Project-Uranium-Godot.
"""
import os
import urllib.parse
import urllib.request

BASE = 'https://raw.githubusercontent.com/acedogblast/Project-Uranium-Godot/master/'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, '.assets-src', 'uranium')

FILES = [
    # tilesets (png + tsx)
    'Maps/tilesets/PU_groundtiles+.png',
    'Maps/tilesets/PU_buildings+.png',
    'Maps/tilesets/PU_watertiles+.png',
    'Maps/tilesets/PU_caves.png',
    'Maps/tilesets/PU_indoors+.png',
    'Maps/tilesets/PU_anim_tiles.png',
    'Maps/tilesets/PU_autotiles.png',
    'Maps/tilesets/terrain_tags.png',
    'Maps/tilesets/PU_groundtiles+.tsx',
    'Maps/tilesets/PU_buildings+.tsx',
    'Maps/tilesets/PU_watertiles+.tsx',
    'Maps/tilesets/PU_caves.tsx',
    'Maps/tilesets/PU_indoors+.tsx',
    'Maps/tilesets/PU_anim_tiles.tsx',
    'Maps/tilesets/PU_autotiles.tsx',
    # previews
    'Maps/Map images/Moki Town.png',
    'Maps/Map images/Nowtoch City.png',
    'Maps/Map images/Route1.png',
    'Maps/Map images/Route 2.png',
    'Maps/Map images/Route 3.png',
    'Maps/Map images/Kevlar Town.png',
    # mapas tiled reales
    'Maps/MokiTown/Moki Town.tmx',
    'Maps/MokiTown/Moki NPC Houses.tmx',
    'Maps/MokiTown/Player House.tmx',
    'Maps/MokiTown/Professor Lab.tmx',
    'Maps/MokiTown/Rival House.tmx',
    'Maps/NowtochCity/Nowtoch City.tmx',
    'Maps/NowtochCity/Nowtoch NPC Houses.tmx',
    'Maps/Routes/Route1/Route1.tmx',
    'Maps/Routes/Route2/Route 2.tmx',
    'Maps/Routes/Route3/Route 3.tmx',
    'Maps/KevlarTown/Kevlar Town.tmx',
    'Maps/BuroleTown/Burole Town.tmx',
    'Maps/Towns/Town Houses/Pokecenter.tmx',
    'Maps/Towns/Town Houses/Pokemart.tmx',
    'LICENSE',
]


def main():
    for rel in FILES:
        url = BASE + urllib.parse.quote(rel)
        # normaliza el nombre local
        local = rel.replace('Maps/', '').replace('/', '__')
        path = os.path.join(DEST, local)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        try:
            with urllib.request.urlopen(url, timeout=90) as r:
                data = r.read()
            with open(path, 'wb') as f:
                f.write(data)
            print(f'  ✓ {local:44s} {len(data):>9,}')
        except Exception as e:
            print(f'  ✗ {local}: {e}')


if __name__ == '__main__':
    print(f'==> Descargando Uranium en {DEST}')
    main()
