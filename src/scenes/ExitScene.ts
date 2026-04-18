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

    this.createPortals();
  }

  private createPortals(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');

    const exitBtn = this.createButton(GAME_WIDTH / 2, GAME_HEIGHT - 60, 'Vibe Jam Portal', () => {
      const newParams = new URLSearchParams();
      newParams.append('portal', 'true');
      newParams.append('username', 'pop_tiles_player');
      newParams.append('color', 'blue');
      newParams.append('speed', '10');

      for (const [key, value] of urlParams) {
        newParams.append(key, value);
      }

      const paramString = newParams.toString();
      const nextPage = 'https://vibej.am/portal/2026' + (paramString ? '?' + paramString : '');
      window.location.href = nextPage;
    });
    // @ts-ignore - changing style
    exitBtn.button.setStrokeStyle(2, 0x00ff00, 1);
    // @ts-ignore
    exitBtn.text.setColor('#00ff00');

    if (ref) {
      const returnBtn = this.createButton(GAME_WIDTH / 2, GAME_HEIGHT - 20, 'Return Portal', () => {
        let url = ref;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        const newParams = new URLSearchParams();
        for (const [key, value] of urlParams) {
            if (key !== 'ref') {
                newParams.append(key, value);
            }
        }
        const paramString = newParams.toString();
        window.location.href = url + (paramString ? '?' + paramString : '');
      });
      // @ts-ignore
      returnBtn.button.setStrokeStyle(2, 0xff0000, 1);
      // @ts-ignore
      returnBtn.text.setColor('#ff0000');
    }
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): { button: Phaser.GameObjects.Rectangle, text: Phaser.GameObjects.Text } {
    const button = this.add
      .rectangle(x, y, 220, 32, 0xfffdf7, 1)
      .setStrokeStyle(2, 0xd5c3a5, 1)
      .setInteractive({ useHandCursor: true });

    const textLabel = this.add
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

    return { button, text: textLabel };
  }
}
