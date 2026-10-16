#!/usr/bin/env bash
# Descarga tilesets de exterior de Magiscarf (DeviantArt) a resolución completa.
#
# DeviantArt expone la imagen original en las meta etiquetas og:image, pero la
# URL lleva un token (JWT) temporal. Por eso este script:
#   1. descarga la página del artwork,
#   2. extrae la URL base + token del CDN,
#   3. reconstruye la URL a resolución completa (<=1920x3360) y la descarga.
#
# Uso:  tools/fetch-tilesets.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${OUT:-$ROOT/tools/art/magiscarf}"
mkdir -p "$OUT"

# "slug|url-del-artwork"
FILES=(
  "tileset_v3|https://www.deviantart.com/magiscarf/art/Tileset-ver.3-%5BFree%2A%5D-690477146"
  "new_tiles_mastersheet|https://www.deviantart.com/magiscarf/art/%5BFree%5D-New-Tiles-Mastersheet-648639390"
  "rustic_tiles|https://www.deviantart.com/magiscarf/art/%5BFree%5D-Rustic-Tiles-w-updates-645876003"
  "more_trees|https://www.deviantart.com/magiscarf/art/More-Trees-726831180"
  "city_tiles|https://www.deviantart.com/magiscarf/art/City-Tiles-702589704"
  "further_tiles|https://www.deviantart.com/magiscarf/art/Further-Additional-More-Tiles-739067524"
  "revamped_tiles|https://www.deviantart.com/magiscarf/art/Revamped-Tiles-829482346"
  "misc_tiles|https://www.deviantart.com/magiscarf/art/Misc.-Tiles-703229080"
  "buildings_snow|https://www.deviantart.com/magiscarf/art/Buildings-Tiles-w-Snow-808246734"
  "water_animation|https://www.deviantart.com/magiscarf/art/Water-Animation-689684144"
  "animated_water|https://www.deviantart.com/magiscarf/art/Next-Animated-Water-Tiles-830567034"
  "frlg_house|https://www.deviantart.com/magiscarf/art/FRLG-style-house-727658094"
  "freebies|https://www.deviantart.com/magiscarf/art/Freebies-447772645"
  "more_freebies|https://www.deviantart.com/magiscarf/art/More-Freebies-453585352"
)

echo "==> Descargando tilesets de Magiscarf en $OUT"
python3 - "$OUT" "${FILES[@]}" <<'PY'
import sys, re, json, base64, subprocess, urllib.request

out = sys.argv[1]
items = [a.split('|', 1) for a in sys.argv[2:]]
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) fetch-tilesets'}

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8', 'ignore')

def token_limits(token):
    """Devuelve (width, height) máximos permitidos por el token (JWT)."""
    payload = token.split('.')[1]
    payload += '=' * (-len(payload) % 4)
    data = json.loads(base64.urlsafe_b64decode(payload))
    obj = data['obj'][0][0]
    w = int(re.sub(r'\D', '', str(obj.get('width', '1920'))) or 1920)
    h = int(re.sub(r'\D', '', str(obj.get('height', '3360'))) or 3360)
    return w, h

for slug, url in items:
    try:
        page = get(url)
        m = re.search(r'<meta property="og:image" content="([^"]+)"', page)
        if not m:
            print(f'  ✗ {slug}: sin og:image'); continue
        og = m.group(1)
        token = re.search(r'token=([^&"]+)', og)
        base = og.split('/v1/')[0]
        if not token:
            print(f'  ✗ {slug}: sin token'); continue
        w, h = token_limits(token.group(1))
        full = f'{base}/v1/fill/w_{w},h_{h},q_100,strp/{slug}.png?token={token.group(1)}'
        dest = f'{out}/{slug}.png'
        subprocess.run(['curl', '-s', '-L', '--max-time', '180', full, '-o', dest], check=True)
        size = int(subprocess.run(['stat', '-c', '%s', dest], capture_output=True, text=True).stdout.strip())
        if size < 1000:
            print(f'  ✗ {slug}: respuesta inválida ({size} bytes)'); continue
        print(f'  ✓ {slug:24s} {w:>5}x{h:<5} {size:>9,} bytes')
    except Exception as e:
        print(f'  ✗ {slug}: {e}')
PY
echo "==> Listo. Archivos en $OUT:"
ls -la "$OUT"
