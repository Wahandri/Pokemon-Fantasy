#!/usr/bin/env bash
# Trae SOLO los assets necesarios del repositorio pokerogue-assets mediante
# sparse-checkout (evita descargar los ~5 GB completos).
#
#   - Sprites Gen5 animados front/back de los Pokédex 1..150
#   - Entrenadores, personajes (rival), arenas y efectos de ataque
#   - Definiciones de animaciones de movimientos (battle-anims/*.json)
set -euo pipefail

REPO="https://github.com/pagefaultgames/pokerogue-assets.git"
BRANCH="beta"
MAX_DEX="${MAX_DEX:-150}"
DEST="${DEST:-/opt/server/apps/poke-rpg/.assets-src}"

echo "==> Preparando sparse-checkout en $DEST (Pokédex 1..$MAX_DEX)"
rm -rf "$DEST"
git clone --depth 1 --filter=blob:none --no-checkout --branch "$BRANCH" "$REPO" "$DEST" 2>&1 | tail -3

cd "$DEST"
git sparse-checkout init --no-cone

PATTERNS="$DEST/.sparse-patterns"
: > "$PATTERNS"

# Carpetas completas que necesitamos
cat >> "$PATTERNS" <<'EOF'
/images/trainer/
/images/character/
/images/arenas/
/images/battle_anims/
/images/effects/
/images/pokeball/
/images/ui/font/
/battle-anims/
/REUSE.toml
/README.md
EOF

# Sprites puntuales de los Pokédex 1..MAX_DEX (front + back + json de datos)
for i in $(seq 1 "$MAX_DEX"); do
  echo "/images/pokemon/$i.png"        >> "$PATTERNS"
  echo "/images/pokemon/$i.json"       >> "$PATTERNS"
  echo "/images/pokemon/back/$i.png"   >> "$PATTERNS"
  echo "/images/pokemon/back/$i.json"  >> "$PATTERNS"
done

cp "$PATTERNS" .git/info/sparse-checkout
git checkout "$BRANCH" 2>&1 | tail -3

echo "==> Descargado:"
du -sh "$DEST"
echo "Archivos pokemon: $(find "$DEST/images/pokemon" -maxdepth 1 -name '*.png' | wc -l) front, $(find "$DEST/images/pokemon/back" -name '*.png' 2>/dev/null | wc -l) back"
echo "Entrenadores: $(find "$DEST/images/trainer" -name '*.png' | wc -l)"
echo "Animaciones: $(find "$DEST/battle-anims" -name '*.json' | wc -l)"
