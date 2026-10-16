import Phaser from 'phaser';
import { randomStarters, type SpeciesData } from '../data';
import { IDLE, loadPokemon } from '../systems/assets';
import { Monster } from '../systems/battle';
import { FONT, GAME_H, GAME_W, panel, TYPE_COLORS } from '../ui/helpers';
import { saveGame, state } from '../state';

export class StarterScene extends Phaser.Scene {
  private options: SpeciesData[] = [];
  private chosen = -1;

  constructor() {
    super('Starter');
  }

  async create(): Promise<void> {
    this.cameras.main.setBackgroundColor('#0b1225');
    this.options = randomStarters(3);

    this.add
      .text(GAME_W / 2, 22, '¡Elige tu primer Pokémon!', { fontFamily: FONT, fontSize: '15px', color: '#f8fafc' })
      .setOrigin(0.5);
    this.add
      .text(GAME_W / 2, 40, '3 Pokémon de primera evolución al azar', { fontFamily: FONT, fontSize: '9px', color: '#94a3b8' })
      .setOrigin(0.5);

    await loadPokemon(this, this.options.map((s) => s.num));

    const cw = 150;
    const startX = GAME_W / 2 - cw;
    const cards: Phaser.GameObjects.Container[] = [];

    this.options.forEach((sp, i) => {
      const x = startX + i * cw;
      const y = 130;
      panel(this, x - 66, y - 74, 132, 156, 0x14203a, 0x4660a0);

      const sprite = this.add.sprite(x, y - 30, 'pokemon').setOrigin(0.5);
      sprite.setTexture(`pokemon-${sp.num}`);
      sprite.play(IDLE(sp.num));

      const fit = Math.min(80 / sprite.width, 80 / sprite.height);
      sprite.setScale(fit);

      this.add
        .text(x, y + 16, sp.name, { fontFamily: FONT, fontSize: '12px', color: '#ffffff' })
        .setOrigin(0.5);

      let tx = x - (sp.types.length * 30) / 2;
      for (const t of sp.types) {
        const g = this.add.graphics();
        g.fillStyle(TYPE_COLORS[t] ?? 0x777777, 1).fillRoundedRect(tx, y + 28, 28, 12, 4);
        this.add.text(tx + 14, y + 34, t.slice(0, 4), { fontFamily: FONT, fontSize: '7px', color: '#111' }).setOrigin(0.5);
        tx += 30;
      }

      const b = sp.baseStats;
      this.add
        .text(x, y + 48, `PS ${b.hp}  ATK ${b.atk}  DEF ${b.def}`, { fontFamily: FONT, fontSize: '7px', color: '#cbd5e1' })
        .setOrigin(0.5);
      this.add
        .text(x, y + 58, `SPA ${b.spa}  SPD ${b.spd}  VEL ${b.spe}`, { fontFamily: FONT, fontSize: '7px', color: '#cbd5e1' })
        .setOrigin(0.5);

      const gl = this.add.graphics();
      const c = this.add.container(0, 0, [gl]);
      c.setSize(132, 156);
      c.setInteractive(new Phaser.Geom.Rectangle(x - 66, y - 74, 132, 156), Phaser.Geom.Rectangle.Contains);
      c.setData('glow', gl);
      c.setData('rect', [x - 66, y - 74, 132, 156]);
      c.on('pointerdown', () => this.choose(i, cards));
      cards.push(c);
    });

    this.chosen = -1;
  }

  private choose(index: number, cards: Phaser.GameObjects.Container[]): void {
    this.chosen = index;
    cards.forEach((c, i) => {
      const gl = c.getData('glow') as Phaser.GameObjects.Graphics;
      const [x, y, w, h] = c.getData('rect') as number[];
      gl.clear();
      if (i === index) {
        gl.lineStyle(3, 0xfbbf24, 1).strokeRoundedRect(x, y, w, h, 8);
      }
    });

    const sp = this.options[index];
    state.party = [new Monster(sp.num, 5)];
    state.activeIndex = 0;
    saveGame();

    const msg = this.add
      .text(GAME_W / 2, GAME_H - 26, `¡Has elegido a ${sp.name}!`, {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#86efac',
      })
      .setOrigin(0.5);
    msg.setDepth(10);

    this.time.delayedCall(700, () => this.scene.start('Overworld'));
  }
}
