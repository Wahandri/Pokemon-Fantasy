import Phaser from 'phaser';
import { charKey, loadCharacters, STAND_FRAME } from '../systems/characters';
import { AVATARS } from '../systems/world';
import { FONT, GAME_H, GAME_W, makeButton } from '../ui/helpers';
import { hasSave, loadGame, state } from '../state';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  preload(): void {
    this.load.image('menu-bg', 'menu-bg.png');
    this.load.on('loaderror', () => void 0);
  }

  async create(): Promise<void> {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#0b1225');

    // Fondo con una imagen real del juego, oscurecida
    if (this.textures.exists('menu-bg')) {
      const bg = this.add.image(GAME_W / 2, GAME_H / 2, 'menu-bg');
      const scale = Math.max(GAME_W / bg.width, GAME_H / bg.height);
      bg.setScale(scale).setScrollFactor(0);
      const shade = this.add.graphics();
      shade.fillStyle(0x05080f, 0.55).fillRect(0, 0, GAME_W, GAME_H);
      shade.fillStyle(0x05080f, 0.75).fillRect(0, 0, GAME_W, 96);
    } else {
      this.add.graphics().fillStyle(0x0b1225, 1).fillRect(0, 0, GAME_W, GAME_H);
    }

    const cx = GAME_W / 2;

    // Título
    const titleShadow = this.add
      .text(cx + 2, 33, 'POKÉMON', { fontFamily: FONT, fontSize: '34px', color: '#3b2a00' })
      .setOrigin(0.5);
    const title = this.add
      .text(cx, 31, 'POKÉMON', { fontFamily: FONT, fontSize: '34px', color: '#ffd23f' })
      .setOrigin(0.5);
    const sub = this.add
      .text(cx, 57, 'LEAGUE  ONLINE', { fontFamily: FONT, fontSize: '13px', color: '#dfe9ff' })
      .setOrigin(0.5);

    // Poké Ball animada junto al título
    const ball = this.add.container(title.x + title.width / 2 + 8, 31);
    const g = this.add.graphics();
    g.fillStyle(0xef4444, 1).fillCircle(0, 0, 13);
    g.fillStyle(0xf8fafc, 1).fillRect(-13, 0, 26, 13);
    g.lineStyle(3, 0x111827, 1).strokeCircle(0, 0, 13);
    g.lineStyle(3, 0x111827, 1).lineBetween(-13, 0, 13, 0);
    g.fillStyle(0x111827, 1).fillCircle(0, 0, 5);
    g.fillStyle(0xf8fafc, 1).fillCircle(0, 0, 2.5);
    ball.add(g);
    this.tweens.add({ targets: ball, angle: 360, duration: 4000, repeat: -1 });
    void titleShadow;
    void sub;

    let y = 128;

    makeButton(this, cx, y, 220, 34, '▶  Nueva aventura', () => this.scene.start('Trainer'));
    y += 46;

    if (hasSave()) {
      // Ficha del entrenador guardado
      await loadCharacters(this, AVATARS.map((a) => a.key));
      const card = this.add.container(cx, y - 46);
      const cg = this.add.graphics();
      cg.fillStyle(0x0d1526, 0.8).fillRoundedRect(-150, -30, 300, 60, 10);
      cg.lineStyle(2, 0x5b7cc0, 1).strokeRoundedRect(-150, -30, 300, 60, 10);
      card.add(cg);
      const spr = this.add.sprite(-115, 22, charKey(state.trainerSprite), STAND_FRAME.down).setOrigin(0.5, 0.95);
      spr.setScale(0.75);
      card.add(spr);
      card.add(this.add.text(-80, -20, state.trainerName || 'Entrenador', {
        fontFamily: FONT, fontSize: '13px', color: '#eaf1ff',
      }));
      card.add(this.add.text(-80, 0, `Récord  ${state.wins ?? 0}V · ${state.losses ?? 0}D`, {
        fontFamily: FONT, fontSize: '10px', color: '#94a3b8',
      }));

      makeButton(this, cx, y, 220, 34, '↺  Continuar', () => {
        if (loadGame()) this.scene.start('Overworld');
      });
      y += 46;
    }

    this.add
      .text(cx, GAME_H - 12, 'Flechas / WASD para moverte  ·  la hierba alta esconde Pokémon', {
        fontFamily: FONT, fontSize: '9px', color: '#cbd5e1',
      })
      .setOrigin(0.5)
      .setAlpha(0.85);
  }
}
