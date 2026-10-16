import Phaser from 'phaser';
import { charKey, loadCharacters, STAND_FRAME } from '../systems/characters';
import { AVATARS } from '../systems/world';
import { FONT, GAME_H, GAME_W, makeButton, panel } from '../ui/helpers';
import { state } from '../state';

export class TrainerScene extends Phaser.Scene {
  private selected = AVATARS[0].key;
  private cards = new Map<string, Phaser.GameObjects.Container>();

  constructor() {
    super('Trainer');
  }

  private overlay(): HTMLElement | null {
    return document.getElementById('trainer-overlay');
  }

  private inputEl(): HTMLInputElement | null {
    return document.getElementById('trainer-name-input') as HTMLInputElement | null;
  }

  async create(): Promise<void> {
    this.cameras.main.setBackgroundColor('#0b1225');

    const overlay = this.overlay();
    const input = this.inputEl();
    if (overlay) overlay.style.display = 'flex';
    if (input) {
      input.value = state.trainerName || '';
      input.oninput = () => (state.trainerName = input.value);
    }

    await loadCharacters(this, AVATARS.map((a) => a.key));

    const cols = 4;
    const cw = 74;
    const ch = 60;
    const startX = GAME_W / 2 - ((cols - 1) * cw) / 2;
    const startY = 96;

    AVATARS.forEach((av, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * cw;
      const y = startY + row * ch;

      const bg = panel(this, x - 32, y - 26, 64, 60, 0x14203a, 0x4660a0);
      const sprite = this.add.sprite(x, y + 10, charKey(av.key), STAND_FRAME.down).setOrigin(0.5, 0.95);
      sprite.setScale(52 / 64);
      const label = this.add
        .text(x, y - 18, av.name, { fontFamily: FONT, fontSize: '7px', color: '#cbd5e1' })
        .setOrigin(0.5);

      const c = this.add.container(0, 0, [sprite, label]);
      c.setSize(64, 60);
      c.setInteractive(new Phaser.Geom.Rectangle(x - 32, y - 26, 64, 60), Phaser.Geom.Rectangle.Contains);
      c.setData('bg', bg);
      c.setData('rect', [x - 32, y - 26, 64, 60]);
      c.on('pointerdown', () => this.select(av.key));
      this.cards.set(av.key, c);
    });

    this.select(this.selected);

    makeButton(this, GAME_W / 2, GAME_H - 24, 220, 30, '✔  Comenzar aventura', () => {
      const value = this.inputEl()?.value?.trim();
      if (!value) {
        this.cameras.main.shake(150, 0.006);
        this.inputEl()?.focus();
        return;
      }
      state.trainerName = value;
      state.trainerSprite = this.selected;
      this.scene.start('Starter');
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      const o = this.overlay();
      if (o) o.style.display = 'none';
    });
  }

  private select(key: string): void {
    this.selected = key;
    for (const [k, card] of this.cards) {
      const bg = card.getData('bg') as Phaser.GameObjects.Graphics;
      const [x, y, w, h] = card.getData('rect') as number[];
      bg.clear();
      if (k === key) {
        bg.fillStyle(0x1d3a6b, 0.95).fillRoundedRect(x, y, w, h, 8);
        bg.lineStyle(3, 0xfbbf24, 1).strokeRoundedRect(x, y, w, h, 8);
      } else {
        bg.fillStyle(0x14203a, 0.95).fillRoundedRect(x, y, w, h, 8);
        bg.lineStyle(2, 0x4660a0, 1).strokeRoundedRect(x, y, w, h, 8);
      }
    }
  }
}
