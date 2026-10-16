import Phaser from 'phaser';
import { SPECIES } from '../data';
import { FONT } from '../ui/helpers';
import { saveGame, state } from '../state';
import { AVATARS, DEFAULT_PLAYER, feetTile, LINKS, ow5For, type Direction, type GameMap } from '../systems/world';
import { charKey, loadCharacters, STAND_FRAME, walkAnim, type Facing } from '../systems/characters';

const SPEED = 72;
const ENCOUNTER_CHANCE = 0.12;
const TILE = 16;
const TILESET_KEY = 'uranium';
const TILESET_IMAGE = 'tilesets/uranium/tilesets.png';

export class OverworldScene extends Phaser.Scene {
  private map!: GameMap;
  private tilemap?: Phaser.Tilemaps.Tilemap;
  private baseLayer?: Phaser.Tilemaps.TilemapLayer;
  private groundLayer?: Phaser.Tilemaps.TilemapLayer;
  private npcSprites: Phaser.GameObjects.Sprite[] = [];
  private player!: Phaser.GameObjects.Sprite;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private encounterCooldown = 0;
  private stepAccum = 0;
  private hud!: Phaser.GameObjects.Text;
  private loading = false;
  private facing: Facing = 'down';

  constructor() {
    super('Overworld');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b1225');
    this.hud = this.add
      .text(6, 6, '', {
        fontFamily: FONT,
        fontSize: '9px',
        color: '#f8fafc',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 3 },
      })
      .setScrollFactor(0)
      .setDepth(100000);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.W = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keys.A = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keys.S = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keys.D = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    for (const mon of state.party) {
      mon.hp = mon.stats.hp;
      mon.moves.forEach((m) => (m.pp = m.maxPp));
    }
    saveGame();

    const startMap = (this.registry.get('mapId') as string) || 'moki';
    void this.loadMap(startMap, this.registry.get('spawnAt') as { x: number; y: number } | undefined);
  }

  private async loadMap(id: string, spawnAt?: { x: number; y: number }, from?: Direction): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.registry.set('mapId', id);
    this.registry.remove('spawnAt');

    const map = await this.fetchMap(id);
    this.map = map;

    // Valida el avatar elegido; si no es uno conocido, usa el por defecto
    const playerName = AVATARS.some((a) => a.key === state.trainerSprite)
      ? state.trainerSprite
      : DEFAULT_PLAYER;
    const npcKeys = map.npcs.map((n) => ow5For(n.sprite));
    await loadCharacters(this, [playerName, ...npcKeys]);
    await this.ensureTilemap(id);

    this.tilemap?.destroy();
    this.npcSprites.forEach((n) => n.destroy());
    this.npcSprites = [];

    const worldW = map.width * TILE;
    const worldH = map.height * TILE;

    this.tilemap = this.make.tilemap({ key: `map-${id}` });
    const tileset = this.tilemap.addTilesetImage(TILESET_KEY, 'tiles-outdoor', TILE, TILE, 0, 0)!;
    // crea todas las capas del mapa Tiled, en orden (profundidad creciente)
    this.tilemap.layers.forEach((lay, i) => {
      const l = this.tilemap!.createLayer(lay.name, tileset, 0, 0);
      if (l) {
        l.setDepth(i);
        lay.tilemapLayer = l;
      }
    });
    this.groundLayer = this.tilemap.layers[this.tilemap.layers.length - 1]?.tilemapLayer ?? undefined;

    for (const npc of map.npcs) {
      const key = charKey(ow5For(npc.sprite));
      if (!this.textures.exists(key)) continue;
      const spr = this.add.sprite(npc.x * TILE + TILE / 2, npc.y * TILE + TILE, key, STAND_FRAME.down);
      spr.setOrigin(0.5, 0.95);
      spr.setScale(0.5);
      spr.setDepth(spr.y);
      this.npcSprites.push(spr);
    }

    const playerKey = charKey(playerName);
    const useKey = this.textures.exists(playerKey) ? playerKey : charKey(DEFAULT_PLAYER);

    const pos = this.resolveSpawn(map, spawnAt, from);
    if (!this.player) {
      this.player = this.add.sprite(pos.x, pos.y, useKey, STAND_FRAME.down);
      this.player.setOrigin(0.5, 0.95);
    } else {
      this.player.setTexture(useKey);
      this.player.setPosition(pos.x, pos.y);
    }
    this.player.setScale(0.5);
    this.player.setFlipX(false);
    this.player.setDepth(this.player.y);
    this.facing = 'down';
    this.player.anims.stop();
    this.player.setFrame(STAND_FRAME.down);

    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.startFollow(this.player, true, 0.2, 0.2);
    this.cameras.main.setZoom(2);

    this.encounterCooldown = 800;
    this.stepAccum = 0;
    this.loading = false;
    this.updateHud();
  }

  private resolveSpawn(map: GameMap, spawnAt?: { x: number; y: number }, from?: Direction): { x: number; y: number } {
    let p: { x: number; y: number };
    if (spawnAt) p = spawnAt;
    else if (from) {
      switch (from) {
        case 'down': p = { x: (map.width * TILE) / 2, y: map.height * TILE - 20 }; break;
        case 'up': p = { x: (map.width * TILE) / 2, y: 24 }; break;
        case 'left': p = { x: map.width * TILE - 20, y: (map.height * TILE) / 2 }; break;
        default: p = { x: 20, y: (map.height * TILE) / 2 }; break;
      }
    } else p = { x: map.spawn.x * TILE + TILE / 2, y: map.spawn.y * TILE + TILE };

    // si el punto cae en una celda bloqueada, busca la más cercana libre
    const solid = (tx: number, ty: number): boolean => {
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
      return map.collision[ty][tx] === 1;
    };
    const cell = { tx: Math.floor(p.x / TILE), ty: Math.floor((p.y - 1) / TILE) };
    if (solid(cell.tx, cell.ty)) {
      for (let r = 1; r < 12; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = cell.tx + dx, ny = cell.ty + dy;
            if (!solid(nx, ny)) return { x: nx * TILE + TILE / 2, y: ny * TILE + TILE };
          }
        }
      }
    }
    return p;
  }

  private async fetchMap(id: string): Promise<GameMap> {
    const res = await fetch(`maps/${id}.json`);
    return (await res.json()) as GameMap;
  }

  private ensureTilemap(id: string): Promise<void> {
    if (this.cache.tilemap.exists(`map-${id}`)) return Promise.resolve();
    return new Promise((resolve) => {
      this.load.tilemapTiledJSON(`map-${id}`, `maps/${id}.tmj`);
      if (!this.textures.exists('tiles-outdoor')) {
        this.load.image('tiles-outdoor', TILESET_IMAGE);
      }
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.start();
    });
  }

  private updateHud(): void {
    if (!this.hud || !this.map) return;
    const mon = state.party[0];
    const name = state.trainerName || 'Entrenador';
    const monTxt = mon ? `${mon.name} Nv.${mon.level}  PS ${mon.hp}/${mon.stats.hp}` : 'Sin Pokémon';
    this.hud.setText(`${name} · ${this.map.name}\n${monTxt}   ${state.wins}V ${state.losses}D`);
  }

  private solidAt(px: number, py: number): boolean {
    const { tx, ty } = feetTile(px, py, TILE);
    if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return false;
    return this.map.collision[ty][tx] === 1;
  }

  /** Caja pequeña a los pies del personaje (ancho 10, alto 8) para colisiones correctas. */
  private blockedAt(x: number, y: number): boolean {
    return (
      this.solidAt(x - 5, y - 1) ||
      this.solidAt(x + 5, y - 1) ||
      this.solidAt(x - 5, y - 7) ||
      this.solidAt(x + 5, y - 7)
    );
  }

  private isEncounter(px: number, py: number): boolean {
    const { tx, ty } = feetTile(px, py, TILE);
    if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return false;
    return this.map.encounters[ty][tx] === 1;
  }

  update(_t: number, delta: number): void {
    if (this.loading || !this.player || !this.map) return;
    if (this.encounterCooldown > 0) this.encounterCooldown -= delta;

    const k = this.keys;
    const left = k.LEFT.isDown || k.A.isDown;
    const right = k.RIGHT.isDown || k.D.isDown;
    const up = k.UP.isDown || k.W.isDown;
    const down = k.DOWN.isDown || k.S.isDown;

    const dx = left ? -1 : right ? 1 : 0;
    const dy = up ? -1 : down ? 1 : 0;
    const moving = dx !== 0 || dy !== 0;
    const name = this.player.texture.key.replace('ow5-', '');

    if (!moving) {
      this.player.anims.stop();
      this.player.setFrame(STAND_FRAME[this.facing]);
      return;
    }

    const step = (SPEED * delta) / 1000;

    if (dx !== 0) {
      const nx = this.player.x + dx * step;
      if (!this.blockedAt(nx, this.player.y)) this.player.x = nx;
      this.facing = dx < 0 ? 'left' : 'right';
    } else {
      const ny = this.player.y + dy * step;
      if (!this.blockedAt(this.player.x, ny)) this.player.y = ny;
      this.facing = dy < 0 ? 'up' : 'down';
    }
    this.player.play(walkAnim(name, this.facing), true);

    this.player.setDepth(this.player.y);

    if (this.isEncounter(this.player.x, this.player.y) && this.encounterCooldown <= 0) {
      this.stepAccum += step;
      const hasHealthy = state.party.some((m) => m.hp > 0);
      if (hasHealthy && this.stepAccum > 10 && Math.random() < ENCOUNTER_CHANCE) {
        this.startWildBattle();
        return;
      }
    } else {
      this.stepAccum = 0;
    }

    this.checkLinks();
  }

  private checkLinks(): void {
    const w = this.map.width * TILE;
    const h = this.map.height * TILE;
    const links = LINKS[this.map.id] ?? {};

    // warps explícitos (celda exacta) tienen prioridad
    const { tx, ty } = feetTile(this.player.x, this.player.y, TILE);
    const warp = this.map.warps?.find((wp) => wp.x === tx && wp.y === ty);
    if (warp && warp.dest) {
      this.player.anims.stop();
      this.loading = true;
      this.cameras.main.fadeOut(150, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.cameras.main.fadeIn(150, 0, 0, 0);
        this.loading = false;
        void this.loadMap(warp.dest, undefined, 'down');
      });
      return;
    }

    let dir: Direction | null = null;
    if (this.player.y < 4 && links.up) dir = 'up';
    else if (this.player.y > h - 4 && links.down) dir = 'down';
    else if (this.player.x < 4 && links.left) dir = 'left';
    else if (this.player.x > w - 4 && links.right) dir = 'right';

    if (dir && links[dir]) {
      const target = links[dir]!;
      this.player.anims.stop();
      this.loading = true;
      this.cameras.main.fadeOut(150, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.cameras.main.fadeIn(150, 0, 0, 0);
        this.loading = false;
        void this.loadMap(target, undefined, dir!);
      });
    }
  }

  private startWildBattle(): void {
    this.encounterCooldown = 1500;
    this.stepAccum = 0;
    let num: number;
    let level: number;
    const wild = this.map.wild;
    if (wild && wild.table.length) {
      const entry = wild.table[Math.floor(Math.random() * wild.table.length)];
      num = entry.num;
      level = entry.min + Math.floor(Math.random() * Math.max(1, entry.max - entry.min + 1));
    } else {
      const pool = SPECIES.filter((s) => s.num <= 150 && !s.isLegendary);
      const sp = pool[Math.floor(Math.random() * pool.length)];
      num = sp.num;
      level = 3 + Math.floor(Math.random() * 4);
    }
    this.cameras.main.flash(220, 255, 255, 255);
    this.scene.sleep('Overworld');
    this.scene.run('Battle', { enemyNum: num, enemyLevel: level, kind: 'wild' });
  }

  onBattleEnd(): void {
    this.encounterCooldown = 2500;
    for (const mon of state.party) {
      mon.hp = mon.stats.hp;
      mon.moves.forEach((m) => (m.pp = m.maxPp));
    }
    saveGame();
    this.updateHud();
  }
}
