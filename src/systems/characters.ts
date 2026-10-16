import Phaser from 'phaser';

// Sprites de OVERWORLD de Gen 5 (formato RMXP): 4 columnas × 4 filas de 64×64.
// Filas: 0 = abajo, 1 = izquierda, 2 = derecha, 3 = arriba.
const FW = 64;
const FH = 64;

export type Facing = 'down' | 'up' | 'left' | 'right';

export const charKey = (name: string) => `ow5-${name}`;

/** Frame "quieto" por dirección (el 1 es el neutral en RMXP). */
export const STAND_FRAME: Record<Facing, number> = { down: 1, up: 13, left: 5, right: 9 };

/** Patrón de caminar RMXP [0,1,2,1] por fila. */
const WALK: Record<Facing, number[]> = {
  down: [0, 1, 2, 1],
  up: [12, 13, 14, 13],
  left: [4, 5, 6, 5],
  right: [8, 9, 10, 9],
};

function makeAnims(scene: Phaser.Scene, name: string): void {
  const key = charKey(name);
  if (!scene.textures.exists(key)) return;
  const total = scene.textures.get(key).getFrameNames().length;
  (Object.keys(WALK) as Facing[]).forEach((dir) => {
    const animKey = `ow-walk-${dir}-${name}`;
    if (scene.anims.exists(animKey)) return;
    const frames = WALK[dir];
    if (frames.some((f) => f >= total)) return;
    scene.anims.create({
      key: animKey,
      frames: frames.map((f) => ({ key, frame: f })),
      frameRate: 8,
      repeat: -1,
    });
  });
}

/** Carga (si hace falta) los sprites de personajes como spritesheets 64×64. */
export async function loadCharacters(scene: Phaser.Scene, names: string[]): Promise<void> {
  const missing = [...new Set(names)].filter((n) => !scene.textures.exists(charKey(n)));
  if (missing.length) {
    await new Promise<void>((resolve) => {
      for (const n of missing) {
        scene.load.spritesheet(charKey(n), `ow5/${n}.png`, { frameWidth: FW, frameHeight: FH });
      }
      scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      scene.load.start();
    });
  }
  for (const n of names) makeAnims(scene, n);
}

export const walkAnim = (name: string, dir: Facing) => `ow-walk-${dir}-${name}`;
