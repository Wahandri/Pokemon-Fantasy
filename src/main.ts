import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { TrainerScene } from './scenes/TrainerScene';
import { StarterScene } from './scenes/StarterScene';
import { OverworldScene } from './scenes/OverworldScene';
import { BattleScene } from './scenes/BattleScene';
import { GAME_H, GAME_W } from './ui/helpers';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#0b1225',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, TrainerScene, StarterScene, OverworldScene, BattleScene],
};

const game = new Phaser.Game(config);

// Expuesto para depuración/pruebas automatizadas (no afecta al juego).
(window as unknown as { __game: Phaser.Game }).__game = game;

export default game;
