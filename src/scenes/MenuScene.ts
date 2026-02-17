import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../consts';

type SpeedMode = 'time' | 'score';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    const centerX = GAME_WIDTH / 2;

    this.add
      .rectangle(centerX, GAME_HEIGHT / 2, GAME_WIDTH - 30, GAME_HEIGHT - 40, 0x071121, 0.58)
      .setStrokeStyle(2, 0x355272, 0.8);

    this.add
      .text(centerX, 90, 'Pop Tiles', {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '44px',
        fontStyle: 'bold',
        color: '#f4f8ff',
      })
      .setOrigin(0.5)
      .setScale(0.5);

    this.add
      .text(centerX, 126, 'Choose Speed Progression', {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '26px',
        color: '#cde6ff',
      })
      .setOrigin(0.5)
      .setScale(0.5);

    this.createModeButton(centerX, 200, 'Time Based', 'Speed rises over survival time', 'time');
    this.createModeButton(centerX, 274, 'Score Based', 'Speed rises as your score increases', 'score');

    this.add
      .text(centerX, GAME_HEIGHT - 42, 'Pick 3 matching icons to pop', {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '22px',
        color: '#c3d8f2',
      })
      .setOrigin(0.5)
      .setScale(0.5);
  }

  private createModeButton(x: number, y: number, title: string, subtitle: string, mode: SpeedMode): void {
    const box = this.add
      .rectangle(x, y, 290, 58, 0xfffdf7, 1)
      .setStrokeStyle(2, 0xd5c3a5, 1)
      .setInteractive({ useHandCursor: true });

    const titleText = this.add
      .text(x, y - 8, title, {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#3a2d1d',
      })
      .setOrigin(0.5)
      .setScale(0.5);

    const subtitleText = this.add
      .text(x, y + 12, subtitle, {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '19px',
        color: '#67563f',
      })
      .setOrigin(0.5)
      .setScale(0.5);

    box.on('pointerover', () => {
      box.setFillStyle(0xfff3df, 1);
      box.setScale(1.02);
    });

    box.on('pointerout', () => {
      box.setFillStyle(0xfffdf7, 1);
      box.setScale(1);
    });

    box.on('pointerdown', () => {
      box.disableInteractive();
      titleText.setColor('#1f4e72');
      subtitleText.setColor('#1f4e72');
      this.scene.start('GameScene', { speedMode: mode });
    });
  }
}
