import Phaser from 'phaser';
import './style.css';
import { GAME_HEIGHT, GAME_WIDTH } from './consts';
import { ExitScene } from './scenes/ExitScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';

document.getElementById('app')?.classList.add('game-container');

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'app',
  transparent: true,
  scene: [MenuScene, GameScene, ExitScene],
};

new Phaser.Game(config);
