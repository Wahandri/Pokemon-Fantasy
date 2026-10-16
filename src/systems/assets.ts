import Phaser from 'phaser';

/** Claves de textura/animación para los sprites de Pokémon (front y back). */
export const FRONT = (num: number) => `pokemon-${num}`;
export const BACK = (num: number) => `pokemon-back-${num}`;
export const IDLE = (num: number) => `idle-${num}`;
export const IDLE_BACK = (num: number) => `idle-back-${num}`;
export const TRAINER_TEX = (name: string) => `trainer-${name}`;
export const TRAINER_ANIM = (name: string) => `trainer-anim-${name}`;

const FRAME_FPS = 8;

function makeAnim(scene: Phaser.Scene, texKey: string, animKey: string): void {
  if (!scene.textures.exists(texKey) || scene.anims.exists(animKey)) return;
  const tex = scene.textures.get(texKey);
  const names = tex
    .getFrameNames()
    .filter((n) => n !== '__BASE')
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  if (names.length === 0) return;
  scene.anims.create({
    key: animKey,
    frames: names.map((f) => ({ key: texKey, frame: f })),
    frameRate: FRAME_FPS,
    repeat: -1,
  });
}

/**
 * Carga bajo demanda los atlas (front/back) de una lista de Pokédex y crea
 * sus animaciones idle. Es idempotente: no recarga lo que ya está en memoria.
 */
export async function loadPokemon(scene: Phaser.Scene, nums: number[]): Promise<void> {
  const needed = [...new Set(nums)];
  const front = needed.filter((n) => !scene.textures.exists(FRONT(n)));
  const back = needed.filter((n) => !scene.textures.exists(BACK(n)));

  if (front.length || back.length) {
    await new Promise<void>((resolve) => {
      for (const n of front) {
        scene.load.multiatlas(FRONT(n), `assets/images/pokemon/${n}.json`, 'assets/images/pokemon/');
      }
      for (const n of back) {
        scene.load.multiatlas(BACK(n), `assets/images/pokemon/back/${n}.json`, 'assets/images/pokemon/back/');
      }
      scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      scene.load.start();
    });
  }

  for (const n of needed) {
    makeAnim(scene, FRONT(n), IDLE(n));
    makeAnim(scene, BACK(n), IDLE_BACK(n));
  }
}

/** Carga sprites de entrenador (para selector de entrenador y rivales). */
export async function loadTrainers(scene: Phaser.Scene, names: string[]): Promise<void> {
  const missing = names.filter((n) => !scene.textures.exists(TRAINER_TEX(n)));
  if (missing.length) {
    await new Promise<void>((resolve) => {
      for (const n of missing) {
        scene.load.multiatlas(TRAINER_TEX(n), `assets/images/trainer/${n}.json`, 'assets/images/trainer/');
      }
      scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      scene.load.start();
    });
  }
  for (const n of names) makeAnim(scene, TRAINER_TEX(n), TRAINER_ANIM(n));
}

/** Primer frame disponible de una textura (para usar como imagen estática). */
export function firstFrame(scene: Phaser.Scene, texKey: string): string | undefined {
  if (!scene.textures.exists(texKey)) return undefined;
  return scene.textures.get(texKey).getFrameNames().filter((n) => n !== '__BASE').sort()[0];
}
