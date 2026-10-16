import Phaser from 'phaser';

export const GAME_W = 512;
export const GAME_H = 288;

export const FONT = 'monospace';

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillStyle(0x1b2a4a, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 8);
  g.lineStyle(2, 0x5b7cc0, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
  const t = scene.add
    .text(0, 0, label, { fontFamily: FONT, fontSize: '14px', color: '#eaf1ff' })
    .setOrigin(0.5);
  const c = scene.add.container(x, y, [g, t]);
  c.setSize(w, h);
  c.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  c.on('pointerover', () => {
    g.clear();
    g.fillStyle(0x27406e, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.lineStyle(2, 0x8fb4ff, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    scene.input.setDefaultCursor('pointer');
  });
  c.on('pointerout', () => {
    g.clear();
    g.fillStyle(0x1b2a4a, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.lineStyle(2, 0x5b7cc0, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    scene.input.setDefaultCursor('default');
  });
  c.on('pointerdown', onClick);
  return c;
}

export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = 0x101a30,
  border = 0x4660a0,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(fill, 0.95).fillRoundedRect(x, y, w, h, 8);
  g.lineStyle(2, border, 1).strokeRoundedRect(x, y, w, h, 8);
  return g;
}

export const TYPE_COLORS: Record<string, number> = {
  Normal: 0xa8a77a, Fire: 0xee8130, Water: 0x6390f0, Electric: 0xf7d02c,
  Grass: 0x7ac74c, Ice: 0x96d9d6, Fighting: 0xc22e28, Poison: 0xa33ea1,
  Ground: 0xe2bf65, Flying: 0xa98ff3, Psychic: 0xf95587, Bug: 0xa6b91a,
  Rock: 0xb6a136, Ghost: 0x735797, Dragon: 0x6f35fc, Dark: 0x705746,
  Steel: 0xb7b7ce, Fairy: 0xd685ad,
};

export function hpColor(ratio: number): number {
  if (ratio > 0.5) return 0x4ade80;
  if (ratio > 0.2) return 0xfacc15;
  return 0xef4444;
}
