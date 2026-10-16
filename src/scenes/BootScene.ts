import Phaser from 'phaser';
import { Monster } from '../systems/battle';
import { state } from '../state';
import { FONT } from '../ui/helpers';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Cargando…', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5);

    // Atajos de depuración: ?debug=menu|trainer|starter|overworld|battle[&map=route102]
    const params = new URLSearchParams(location.search);
    const debug = params.get('debug');
    const mapParam = params.get('map');

    this.time.delayedCall(150, () => {
      if (debug === 'battle') {
        state.trainerName = state.trainerName || 'Test';
        if (!state.party.length) state.party = [new Monster(1, 5)];
        this.scene.start('Battle', { enemyNum: 25, enemyLevel: 5, kind: 'wild' });
        return;
      }
      if (debug === 'overworld') {
        state.trainerName = state.trainerName || 'Test';
        if (!state.party.length) state.party = [new Monster(1, 5)];
        if (mapParam) this.registry.set('mapId', mapParam);
        this.scene.start('Overworld');
        return;
      }
      if (debug === 'starter') {
        state.trainerName = state.trainerName || 'Test';
        this.scene.start('Starter');
        return;
      }
      if (debug === 'trainer') {
        this.scene.start('Trainer');
        return;
      }
      this.scene.start('Menu');
    });
  }
}
