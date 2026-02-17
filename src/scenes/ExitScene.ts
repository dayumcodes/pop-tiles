import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../consts';

export class ExitScene extends Phaser.Scene {
  constructor() {
    super('ExitScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    this.add
      .rectangle(centerX, centerY, GAME_WIDTH - 30, GAME_HEIGHT - 40, 0x071121, 0.72)
      .setStrokeStyle(2, 0x355272, 0.9);

    this.add
      .text(centerX, centerY - 56, 'Game Closed', {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '42px',
        fontStyle: 'bold',
        color: '#f4f8ff',
      })
      .setOrigin(0.5)
      .setScale(0.5);

    this.add
      .text(centerX, centerY - 20, 'Thanks for playing Pop Tiles', {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '24px',
        color: '#cde6ff',
      })
      .setOrigin(0.5)
      .setScale(0.5);

    this.createButton(centerX, centerY + 26, 'Back to Main Menu', () => {
      this.scene.start('MenuScene');
    });

    this.createButton(centerX, centerY + 70, 'Close Tab', () => {
      window.close();
    });
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): void {
    const button = this.add
      .rectangle(x, y, 220, 32, 0xfffdf7, 1)
      .setStrokeStyle(2, 0xd5c3a5, 1)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(x, y, label, {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#3a2d1d',
      })
      .setOrigin(0.5)
      .setScale(0.5);

    button.on('pointerover', () => button.setFillStyle(0xfff0d4, 1));
    button.on('pointerout', () => button.setFillStyle(0xfffdf7, 1));
    button.on('pointerdown', () => onClick());
  }
}
