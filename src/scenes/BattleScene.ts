import Phaser from 'phaser';
import { Battle } from '@pkmn/sim';
import { Dex } from '@pkmn/dex';
import { IDLE, IDLE_BACK, loadPokemon } from '../systems/assets';
import { Monster } from '../systems/battle';
import { FONT, GAME_H, GAME_W, hpColor, TYPE_COLORS } from '../ui/helpers';
import { saveGame, state } from '../state';
import type { PType } from '../data';

interface BattleData {
  enemyNum: number;
  enemyLevel: number;
  kind: 'wild' | 'trainer';
}

const ARENA = 'plains';

function buildSet(mon: Monster) {
  const sp = Dex.species.get(mon.species.name);
  const ability = (Object.values(sp.abilities ?? {})[0] as string) ?? 'No Ability';
  return {
    name: mon.species.name, species: mon.species.name, item: '', ability,
    moves: mon.moves.map((s) => s.move.name), nature: 'Serious', gender: '',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: mon.level,
  };
}

class HpBar {
  private value = 1;
  constructor(private gfx: Phaser.GameObjects.Graphics, private x: number, private y: number, private w: number, private h = 8) {}
  set(ratio: number): void {
    const target = Phaser.Math.Clamp(ratio, 0, 1);
    if (Math.abs(target - this.value) > 0.02) {
      this.gfx.scene.tweens.addCounter({
        from: this.value, to: target, duration: 420, ease: 'Cubic.out',
        onUpdate: (tw) => { this.value = tw.getValue() ?? target; this.draw(); },
        onComplete: () => { this.value = target; this.draw(); },
      });
    } else { this.value = target; this.draw(); }
  }
  draw(): void {
    const g = this.gfx;
    const r = Phaser.Math.Clamp(this.value, 0, 1);
    g.clear();
    g.fillStyle(0x0a0f1c, 1).fillRoundedRect(this.x - 1, this.y - 1, this.w + 2, this.h + 2, 4);
    g.fillStyle(0x334155, 1).fillRoundedRect(this.x, this.y, this.w, this.h, 3);
    if (r > 0) {
      g.fillStyle(hpColor(r), 1).fillRoundedRect(this.x, this.y, Math.max(3, this.w * r), this.h, 3);
      g.fillStyle(0xffffff, 0.25).fillRoundedRect(this.x + 1, this.y + 1, Math.max(2, this.w * r - 2), 2, 1);
    }
  }
}

export class BattleScene extends Phaser.Scene {
  private battle!: Battle;
  private battleData!: BattleData;
  private enemySprite!: Phaser.GameObjects.Sprite;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private enemyHp!: HpBar;
  private playerHp!: HpBar;
  private enemyHpText!: Phaser.GameObjects.Text;
  private playerHpText!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private menu: Phaser.GameObjects.GameObject[] = [];
  private busy = true;
  private over = false;
  private logIndex = 0;

  constructor() { super('Battle'); }

  private typesOf(speciesName: string): PType[] {
    return (Dex.species.get(speciesName).types ?? []) as PType[];
  }

  private get bs(): { requestState?: string } { return this.battle as unknown as { requestState?: string }; }

  async create(data: BattleData): Promise<void> {
    this.battleData = data;
    this.cameras.main.setBackgroundColor('#0d1830');

    const enemyMon = new Monster(data.enemyNum, data.enemyLevel);
    if (state.activeIndex >= state.party.length) state.activeIndex = 0;

    this.battle = new Battle({ formatid: 'gen5customgame' as never });
    this.battle.setPlayer('p1', { team: state.party.map((m) => buildSet(m)) as never, name: state.trainerName || 'Tú' });
    this.battle.setPlayer('p2', { team: [buildSet(enemyMon)] as never, name: 'Salvaje' });
    this.battle.choose('p1', `team ${state.activeIndex + 1}`);
    this.battle.choose('p2', 'team 1');

    const foe = this.battle.p2.active[0];
    const me = this.battle.p1.active[0];
    const foeNum = foe.species.num;
    const meNum = me.species.num;

    await this.loadBattleAssets([foeNum, meNum, ...state.party.map((m) => m.num)]);
    this.drawArena();

    this.enemySprite = this.add.sprite(372, 92, `pokemon-${foeNum}`).setOrigin(0.5).setDepth(5);
    this.fit(this.enemySprite, 104);
    this.enemySprite.play(IDLE(foeNum));
    this.enemySprite.setAlpha(0).setX(420);
    this.tweens.add({ targets: this.enemySprite, x: 372, alpha: 1, duration: 420, ease: 'Cubic.out' });

    this.playerSprite = this.add.sprite(150, 166, `pokemon-back-${meNum}`).setOrigin(0.5).setDepth(5);
    this.fit(this.playerSprite, 104);
    this.playerSprite.play(IDLE_BACK(meNum));
    this.playerSprite.setAlpha(0).setY(190);
    this.tweens.add({ targets: this.playerSprite, y: 166, alpha: 1, duration: 420, ease: 'Cubic.out' });

    this.makeHpBox(14, 16, foe.name, foe.level, this.typesOf(foe.species.name), true);
    this.makeHpBox(GAME_W - 218, 150, me.name, me.level, this.typesOf(me.species.name), false);
    this.enemyHp.set(foe.hp / foe.maxhp);
    this.playerHp.set(me.hp / me.maxhp);
    this.updateHpText();

    this.drawMessageBox();
    this.message = this.add.text(18, 212, '', {
      fontFamily: FONT, fontSize: '12px', color: '#f8fafc', lineSpacing: 4, wordWrap: { width: 202 },
    }).setDepth(20);

    this.logIndex = this.battle.log.length;
    await this.say(`¡Un ${foe.name} salvaje apareció!`, 600);
    await this.say(`¡Adelante, ${me.name}!`, 450);
    this.busy = false;
    this.showMenu();
  }

  private async loadBattleAssets(nums: number[]): Promise<void> {
    const keys = [`${ARENA}_bg`, `${ARENA}_a`, `${ARENA}_b_1`];
    const missing = keys.filter((k) => !this.textures.exists(k));
    if (missing.length) {
      await new Promise<void>((resolve) => {
        for (const k of missing) this.load.image(k, `assets/images/arenas/${k}.png`);
        this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
        this.load.start();
      });
    }
    await loadPokemon(this, [...new Set(nums)]);
  }

  private fit(sprite: Phaser.GameObjects.Sprite, target: number): void {
    const max = Math.max(sprite.width, sprite.height) || 1;
    sprite.setScale(target / max);
  }

  private drawArena(): void {
    if (this.textures.exists(`${ARENA}_bg`)) {
      const bg = this.add.image(GAME_W / 2, 132, `${ARENA}_bg`).setDepth(0);
      bg.setScale(Math.max(GAME_W / bg.width, 240 / bg.height));
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x2a4a7a, 1).fillRect(0, 0, GAME_W, 150);
      g.fillStyle(0x4e7a3a, 1).fillRect(0, 150, GAME_W, GAME_H - 150);
    }
    if (this.textures.exists(`${ARENA}_a`)) this.add.image(372, 116, `${ARENA}_a`).setDepth(2);
    if (this.textures.exists(`${ARENA}_b_1`)) this.add.image(150, 184, `${ARENA}_b_1`).setDepth(2);
  }

  private makeHpBox(x: number, y: number, name: string, level: number, types: PType[], isEnemy: boolean): void {
    const w = 200, h = 52;
    const g = this.add.graphics().setDepth(15);
    g.fillStyle(0x0b1225, 0.92).fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(2, 0x5b7cc0, 1).strokeRoundedRect(x, y, w, h, 8);
    g.fillStyle(0x1c2b46, 1).fillRoundedRect(x + 6, y + 6, w - 12, 16, 5);
    this.add.text(x + 12, y + 8, name.toUpperCase(), { fontFamily: FONT, fontSize: '12px', color: '#ffffff' }).setDepth(16);
    this.add.text(x + w - 12, y + 9, `Nv.${level}`, { fontFamily: FONT, fontSize: '10px', color: '#cbd5e1' }).setOrigin(1, 0).setDepth(16);
    const bar = new HpBar(this.add.graphics().setDepth(16), x + 12, y + 28, w - 24, 8);
    const hpText = this.add.text(x + w - 12, y + 40, '', { fontFamily: FONT, fontSize: '9px', color: '#cbd5e1' }).setOrigin(1, 0).setDepth(16);
    if (isEnemy) { this.enemyHp = bar; this.enemyHpText = hpText; }
    else { this.playerHp = bar; this.playerHpText = hpText; }
    let tx = x + 12;
    for (const t of types) {
      const c = this.add.graphics().setDepth(16);
      c.fillStyle(TYPE_COLORS[t] ?? 0x777777, 1).fillRoundedRect(tx, y + 40, 34, 11, 5);
      c.lineStyle(1, 0x000000, 0.3).strokeRoundedRect(tx, y + 40, 34, 11, 5);
      this.add.text(tx + 17, y + 45.5, t.toUpperCase().slice(0, 5), { fontFamily: FONT, fontSize: '7px', color: '#101418' }).setOrigin(0.5).setDepth(17);
      tx += 38;
    }
  }

  private updateHpText(): void {
    const foe = this.battle.p2.active[0], me = this.battle.p1.active[0];
    if (foe) this.enemyHpText.setText(`${Math.max(0, foe.hp)}/${foe.maxhp}`);
    if (me) this.playerHpText.setText(`${Math.max(0, me.hp)}/${me.maxhp}`);
  }

  private drawMessageBox(): void {
    const g = this.add.graphics().setDepth(18);
    g.fillStyle(0x0b1225, 0.95).fillRoundedRect(8, 200, 222, 80, 10);
    g.lineStyle(2, 0x5b7cc0, 1).strokeRoundedRect(8, 200, 222, 80, 10);
    g.lineStyle(1, 0x27406e, 1).strokeRoundedRect(12, 204, 214, 72, 8);
  }

  private showMenu(): void {
    this.clearMenu();
    const active = this.battle.p1.active[0];
    const slots = active?.moveSlots ?? [];
    const colX = [238, 376];
    const rowY = [202, 230];
    slots.forEach((slot, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const disabled = Boolean(slot.disabled) || slot.pp <= 0;
      const type = (Dex.moves.get(slot.id).type ?? 'Normal') as PType;
      this.menu.push(this.moveButton(colX[col], rowY[row], 130, 24,
        slot.id.replace(/-/g, ' '), `${slot.pp}/${slot.maxpp}`,
        TYPE_COLORS[type] ?? 0x777777, disabled, () => this.onMove(i)));
    });
    this.menu.push(this.moveButton(238, 258, 86, 22, 'Poké Ball', '', 0xef4444, false, () => this.throwBall()));
    this.menu.push(this.moveButton(326, 258, 86, 22, 'Pokémon', '', 0x22c55e, false, () => this.openParty(false)));
    this.menu.push(this.moveButton(414, 258, 92, 22, 'Huir', '', 0x6b7280, false, () => this.tryRun()));
  }

  private moveButton(x: number, y: number, w: number, h: number, label: string, pp: string, color: number, disabled: boolean, onClick: () => void): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    const paint = (hover: boolean) => {
      g.clear();
      g.fillStyle(hover && !disabled ? 0x27406e : 0x16233d, 1).fillRoundedRect(x, y, w, h, 6);
      g.lineStyle(2, disabled ? 0x334155 : color, 1).strokeRoundedRect(x, y, w, h, 6);
      g.fillStyle(color, disabled ? 0.3 : 0.9).fillRoundedRect(x + 4, y + 4, 5, h - 8, 2);
    };
    paint(false);
    const t = this.add.text(x + 15, y + h / 2, label, { fontFamily: FONT, fontSize: '9px', color: disabled ? '#64748b' : '#eaf1ff' }).setOrigin(0, 0.5);
    const p = this.add.text(x + w - 8, y + h / 2, pp, { fontFamily: FONT, fontSize: '8px', color: disabled ? '#475569' : '#9fb3d1' }).setOrigin(1, 0.5);
    const c = this.add.container(0, 0, [g, t, p]).setDepth(20);
    c.setSize(w, h);
    c.setInteractive(new Phaser.Geom.Rectangle(x, y, w, h), Phaser.Geom.Rectangle.Contains);
    c.on('pointerover', () => !disabled && paint(true));
    c.on('pointerout', () => paint(false));
    if (!disabled) c.on('pointerdown', onClick);
    return c;
  }

  private clearMenu(): void {
    this.menu.forEach((m) => m.destroy());
    this.menu = [];
  }

  private async say(text: string, ms = 600): Promise<void> {
    this.message.setText('');
    for (let i = 0; i < text.length; i++) {
      this.message.setText(text.slice(0, i + 1));
      await this.wait(10);
    }
    await this.wait(ms);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() }));
  }

  /** Copia los PS del motor a la partida y fija el activo. */
  private syncParty(): void {
    const team = this.battle.p1.pokemon;
    team.forEach((p, i) => { if (state.party[i]) state.party[i].hp = p.hp; });
    const act = this.battle.p1.active[0];
    const idx = team.findIndex((p) => p === act);
    if (idx >= 0) state.activeIndex = idx;
  }

  private async refreshPlayerSprite(): Promise<void> {
    const me = this.battle.p1.active[0];
    await loadPokemon(this, [me.species.num]);
    this.playerSprite.setTexture(`pokemon-back-${me.species.num}`);
    this.fit(this.playerSprite, 104);
    this.playerSprite.play(IDLE_BACK(me.species.num));
    this.playerSprite.setVisible(true).setAlpha(1).setY(166);
    this.playerHp.set(me.hp / me.maxhp);
    this.updateHpText();
  }

  private chooseEnemyMove(): void {
    if (this.battle.ended) return;
    const foe = this.battle.p2.active[0];
    const usable = (foe?.moveSlots ?? []).map((s, i) => ({ s, i })).filter((x) => !x.s.disabled && x.s.pp > 0);
    const choice = usable.length ? usable[Math.floor(Math.random() * usable.length)].i : 0;
    this.battle.choose('p2', `move ${choice + 1}`);
  }

  private async afterTurn(): Promise<void> {
    if (this.battle.ended) { this.finish(); return; }
    if (this.bs.requestState === 'switch') {
      const team = this.battle.p1.pokemon;
      const act = this.battle.p1.active[0];
      const hasHealthy = team.some((p) => p !== act && !p.fainted);
      if (!hasHealthy) { await this.say('¡No te quedan Pokémon!', 400); this.endBattle('lose'); return; }
      this.syncParty();
      this.openParty(true);
      return;
    }
    this.syncParty();
    this.busy = false;
    this.showMenu();
  }

  private async onMove(index: number): Promise<void> {
    if (this.busy || this.over) return;
    this.busy = true;
    this.clearMenu();
    this.battle.choose('p1', `move ${index + 1}`);
    this.chooseEnemyMove();
    await this.processLog();
    await this.afterTurn();
  }

  private async processLog(): Promise<void> {
    const lines = this.battle.log.slice(this.logIndex);
    this.logIndex = this.battle.log.length;

    for (const line of lines) {
      const m = line.match(/^\|move\|(\w+): [^|]+\|([^|]+)\|/);
      if (m) {
        const isPlayer = m[1] === 'p1';
        const sprite = isPlayer ? this.playerSprite : this.enemySprite;
        const who = isPlayer ? this.battle.p1.active[0]?.name : this.battle.p2.active[0]?.name;
        await this.say(`${who} usó ${m[2]}!`, 280);
        if (sprite.visible) await this.tween({ targets: sprite, x: sprite.x + 18 * (isPlayer ? 1 : -1), duration: 100, yoyo: true });
        continue;
      }
      const sw = line.match(/^\|switch\|(p[12])a?: [^|]+\|([^|]+)\|/);
      if (sw) {
        if (sw[1] === 'p1') await this.say(`¡Adelante, ${sw[2]}!`, 300);
        else await this.say(`¡El rival envía a ${sw[2]}!`, 300);
        continue;
      }
      const dmg = line.match(/^\|-damage\|(p[12])a?: [^|]+\|(\d+)\/(\d+)/);
      if (dmg) {
        const ratio = Number(dmg[2]) / Number(dmg[3]);
        const isP1 = dmg[1] === 'p1';
        if (isP1) this.playerHp.set(ratio); else this.enemyHp.set(ratio);
        const s = isP1 ? this.playerSprite : this.enemySprite;
        if (s.visible) {
          s.setTintFill(0xffffff);
          this.time.delayedCall(120, () => s.clearTint());
        }
        this.updateHpText();
        await this.wait(150);
        continue;
      }
      if (line.startsWith('|-supereffective|')) { await this.say('¡Es muy eficaz!', 240); continue; }
      if (line.startsWith('|-resisted|')) { await this.say('No es muy eficaz…', 240); continue; }
      if (line.startsWith('|-crit|')) { await this.say('¡Golpe crítico!', 240); continue; }
      const st = line.match(/^\|-status\|(\w+): [^|]+\|(\w+)/);
      if (st) {
        const who = st[1] === 'p1' ? this.battle.p1.active[0]?.name : this.battle.p2.active[0]?.name;
        await this.say(`¡${who} sufre ${st[2]}!`, 280);
        continue;
      }
      const faint = line.match(/^\|faint\|(p[12])a?:/);
      if (faint) {
        const isP1 = faint[1] === 'p1';
        await this.faint(isP1 ? this.playerSprite : this.enemySprite);
        continue;
      }
      const cant = line.match(/^\|cant\|(\w+): [^|]+\|([^|]+)/);
      if (cant) { await this.say(`${cant[2]}`, 320); continue; }
    }
    this.updateHpText();
  }

  private async faint(sprite: Phaser.GameObjects.Sprite): Promise<void> {
    sprite.anims.stop();
    await this.tween({ targets: sprite, y: sprite.y + 44, alpha: 0, duration: 380 });
    sprite.setVisible(false);
  }

  private async throwBall(): Promise<void> {
    if (this.busy || this.over) return;
    if (this.battleData.kind === 'trainer') { await this.say('¡No puedes robar el Pokémon de otro!', 400); return; }
    this.busy = true;
    this.clearMenu();
    await this.say('¡Has lanzado una Poké Ball!', 240);

    const ball = this.add.circle(120, 220, 7, 0xef4444).setDepth(30).setStrokeStyle(2, 0x111827);
    const band = this.add.rectangle(120, 220, 14, 4, 0xf8fafc).setDepth(31);
    await this.tween({ targets: [ball, band], x: this.enemySprite.x, y: this.enemySprite.y, duration: 360, ease: 'Quad.out' });
    this.tweens.add({ targets: this.enemySprite, scaleX: 0.1, scaleY: 0.1, alpha: 0.15, duration: 240 });
    await this.wait(280);

    const foe = this.battle.p2.active[0];
    let chance = (1 - foe.hp / foe.maxhp) * 0.75 + 0.12 + (foe.level < 10 ? 0.1 : 0);
    if (foe.status) chance += 0.1;
    chance = Phaser.Math.Clamp(chance, 0.05, 0.95);
    const caught = Math.random() < chance;
    const escapesAt = caught ? 3 : 1 + Math.floor(Math.random() * 2);

    for (let i = 0; i < 3; i++) {
      this.tweens.add({ targets: [ball, band], angle: 20, duration: 120, yoyo: true });
      await this.wait(300);
      if (i + 1 >= escapesAt && !caught) break;
    }

    if (!caught) {
      ball.destroy(); band.destroy();
      this.enemySprite.setVisible(true).setAlpha(1);
      this.fit(this.enemySprite, 104);
      await this.say('¡Oh no! ¡El Pokémon se ha escapado!', 400);
      await this.enemyTurnAfterAction();
      return;
    }

    ball.destroy(); band.destroy();
    await this.say(`¡Has atrapado a ${foe.name}!`, 400);
    if (state.party.length < 6) state.party.push(new Monster(foe.species.num, foe.level));
    saveGame();
    this.endBattle('catch');
  }

  private async enemyTurnAfterAction(): Promise<void> {
    if (this.battle.ended) { this.finish(); return; }
    this.battle.choose('p1', 'move 1');
    this.chooseEnemyMove();
    await this.processLog();
    await this.afterTurn();
  }

  private openParty(forced: boolean): void {
    if (this.busy && !forced) return;
    this.clearMenu();
    const n = state.party.length;
    const w = 300, h = 30 * n + 44;
    const x = (GAME_W - w) / 2, y = (GAME_H - h) / 2;
    const panel = this.add.container(0, 0).setDepth(40);
    const g = this.add.graphics();
    g.fillStyle(0x070c16, 0.97).fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(2, 0x5b7cc0, 1).strokeRoundedRect(x, y, w, h, 10);
    panel.add(g);
    panel.add(this.add.text(x + 14, y + 10, forced ? '¡Elige tu siguiente Pokémon!' : 'Elige un Pokémon', {
      fontFamily: FONT, fontSize: '11px', color: forced ? '#fbbf24' : '#eaf1ff',
    }));

    state.party.forEach((mon, i) => {
      const ry = y + 32 + i * 30;
      const team = this.battle.p1.pokemon[i];
      const faint = (team?.hp ?? mon.hp) <= 0;
      const active = i === state.activeIndex;
      const usable = !faint && !active;
      const bg = this.add.graphics();
      bg.fillStyle(active ? 0x1d3a6b : 0x14203a, 1).fillRoundedRect(x + 10, ry, w - 20, 26, 6);
      bg.lineStyle(1, usable ? 0x4660a0 : 0x334155, 1).strokeRoundedRect(x + 10, ry, w - 20, 26, 6);
      const label = this.add.text(x + 18, ry + 8, `${mon.name}  Nv.${mon.level}`, {
        fontFamily: FONT, fontSize: '10px', color: faint ? '#64748b' : (active ? '#fbbf24' : '#eaf1ff'),
      });
      const hp = this.add.text(x + w - 18, ry + 8, faint ? 'K.O.' : `${mon.hp}/${mon.stats.hp}`, {
        fontFamily: FONT, fontSize: '10px', color: faint ? '#ef4444' : '#86efac',
      }).setOrigin(1, 0);
      panel.add([bg, label, hp]);
      if (usable) {
        const hit = this.add.rectangle(x + w / 2, ry + 13, w - 20, 26, 0xffffff, 0.001)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => { panel.destroy(); void this.doSwitch(i); });
        panel.add(hit);
      }
    });

    if (!forced) {
      panel.add(this.add.text(x + w / 2, y + h - 18, 'Cerrar', { fontFamily: FONT, fontSize: '10px', color: '#93c5fd' })
        .setOrigin(0.5).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { panel.destroy(); this.showMenu(); }));
    }
  }

  private async doSwitch(index: number): Promise<void> {
    this.busy = true;
    this.clearMenu();
    state.activeIndex = index;
    this.battle.choose('p1', `switch ${index + 1}`);
    this.chooseEnemyMove();
    await this.processLog();
    await this.refreshPlayerSprite();
    await this.afterTurn();
  }

  private async tryRun(): Promise<void> {
    if (this.busy || this.over) return;
    this.busy = true;
    this.clearMenu();
    await this.say('¡Intentas huir…!', 350);
    if (Math.random() < 0.6) {
      await this.say('¡Escapaste sin problemas!', 500);
      this.endBattle('run');
      return;
    }
    await this.say('¡No pudiste escapar!', 300);
    await this.enemyTurnAfterAction();
  }

  private finish(): void {
    const anyAlive = this.battle.p1.pokemon.some((p) => !p.fainted);
    this.endBattle(anyAlive ? 'win' : 'lose');
  }

  private endBattle(result: 'win' | 'lose' | 'run' | 'catch'): void {
    if (this.over) return;
    this.over = true;
    this.clearMenu();
    this.syncParty();

    if (result === 'win') {
      this.message.setText('¡Has ganado el combate!');
      state.wins += 1;
      const mon = state.party[state.activeIndex];
      if (mon && mon.level < 100) {
        mon.level += 1;
        const fresh = new Monster(mon.num, mon.level);
        mon.stats = fresh.stats;
        mon.moves = fresh.moves;
      }
    } else if (result === 'lose') {
      this.message.setText('Has perdido…');
      state.losses += 1;
      state.party.forEach((m) => { m.hp = m.stats.hp; });
    } else if (result === 'catch') {
      this.message.setText('¡Pokémon atrapado!');
    } else {
      this.message.setText('Escapaste del combate.');
    }
    saveGame();

    this.time.delayedCall(900, () => {
      this.scene.stop();
      this.scene.wake('Overworld');
      const ow = this.scene.get('Overworld') as unknown as { onBattleEnd?: () => void };
      ow.onBattleEnd?.();
    });
  }
}
