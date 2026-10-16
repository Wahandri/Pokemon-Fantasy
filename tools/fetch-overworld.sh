#!/usr/bin/env bash
# Trae del decompilado oficial (pret/pokeemerald) SOLO lo necesario para el
# overworld: tilesets general+petalburg, layouts y map.json de la zona inicial,
# y los sprites de personajes (jugador/NPCs).
set -euo pipefail

REPO="https://github.com/pret/pokeemerald.git"
BRANCH="master"
DEST="${DEST:-/opt/server/apps/poke-rpg/.decomp}"

echo "==> Sparse-checkout de pokeemerald en $DEST"
rm -rf "$DEST"
git clone --depth 1 --filter=blob:none --no-checkout --branch "$BRANCH" "$REPO" "$DEST" 2>&1 | tail -2
cd "$DEST"
git sparse-checkout init --no-cone

cat > .git/info/sparse-checkout <<'EOF'
/data/tilesets/primary/general/
/data/tilesets/secondary/petalburg/
/data/layouts/layouts.json
/data/layouts/LittlerootTown/
/data/layouts/Route101/
/data/layouts/OldaleTown/
/data/layouts/Route102/
/data/maps/LittlerootTown/map.json
/data/maps/Route101/map.json
/data/maps/OldaleTown/map.json
/data/maps/Route102/map.json
/graphics/object_events/pics/people/
/graphics/object_events/palettes/
EOF

git checkout "$BRANCH" 2>&1 | tail -2
echo "==> Descargado:"; du -sh "$DEST"
ls "$DEST/data/tilesets/primary/general/"
echo "sprites personas: $(find "$DEST/graphics/object_events/pics/people" -name '*.png' | wc -l)"
