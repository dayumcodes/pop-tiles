import Phaser from 'phaser';
import {
  BOARD_X,
  BOARD_Y,
  CLEAR_DELAY,
  DANGER_LINE_Y,
  DROP_DURATION,
  EMOJI_FONT_FAMILY,
  GRID_COLS,
  GRID_ROWS,
  HIGH_SCORE_KEY,
  RISE_START_DELAY_SECONDS,
  RISE_SPEED_ACCEL,
  RISE_SPEED_MAX,
  RISE_SPEED_START,
  SCORE_PER_TILE,
  START_EMPTY_ROWS,
  TILE_EMOJIS,
  TILE_SIZE,
} from '../consts';

type TileKind = number;

type Tile = {
  id: number;
  kind: TileKind;
  col: number;
  row: number;
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Rectangle;
  bg: Phaser.GameObjects.Rectangle;
  shine: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
};

const BoardState = {
  IDLE: 'IDLE',
  PAUSED: 'PAUSED',
  MATCHING: 'MATCHING',
  DROPPING: 'DROPPING',
  GAME_OVER: 'GAME_OVER',
} as const;

type BoardState = (typeof BoardState)[keyof typeof BoardState];
type SpeedMode = 'time' | 'score';

const HUD_FONT = 'Trebuchet MS, Segoe UI, sans-serif';

export class GameScene extends Phaser.Scene {
  private grid: (Tile | null)[][] = [];
  private pendingRow: Tile[] = [];

  private selectedTiles: Tile[] = [];
  private state: BoardState = BoardState.IDLE;

  private risingOffset = 0;
  private elapsedSeconds = 0;
  private riseDelayLeft = RISE_START_DELAY_SECONDS;

  private score = 0;
  private highScore = 0;

  private tileIdCounter = 0;

  private scoreText!: Phaser.GameObjects.Text;
  private highScoreText!: Phaser.GameObjects.Text;
  private helperText!: Phaser.GameObjects.Text;
  private restartKey?: Phaser.Input.Keyboard.Key;
  private pauseKey?: Phaser.Input.Keyboard.Key;
  private escKey?: Phaser.Input.Keyboard.Key;
  private pauseOverlay?: Phaser.GameObjects.Container;
  private boardMask!: Phaser.Display.Masks.GeometryMask;
  private speedMode: SpeedMode = 'time';
  private popSoundEnabled = true;
  private readonly popParticleTextureKey = 'pop-dot';

  constructor() {
    super('GameScene');
  }

  create(data?: { speedMode?: SpeedMode }): void {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.resetRunState();
    this.speedMode = data?.speedMode === 'score' ? 'score' : 'time';

    this.drawSceneDecor();
    this.drawBoardFrame();
    this.createBoardMask();
    this.ensureFxTextures();

    this.highScore = Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0);

    this.createHud();

    this.grid = [];
    for (let row = 0; row < GRID_ROWS; row += 1) {
      const rowData: (Tile | null)[] = [];
      for (let col = 0; col < GRID_COLS; col += 1) {
        if (row < START_EMPTY_ROWS) {
          rowData.push(null);
          continue;
        }

        const kind = this.pickNonMatchingKind(row, col);
        rowData.push(this.createTile(kind, col, row));
      }
      this.grid.push(rowData);
    }

    this.pendingRow = this.spawnNewRow();
    this.createDangerLine();
    this.refreshUi();
    this.restartKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.pauseKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.escKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  update(_: number, delta: number): void {
    const pausePressed =
      (this.pauseKey && Phaser.Input.Keyboard.JustDown(this.pauseKey)) ||
      (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey));
    if (pausePressed) {
      if (this.state === BoardState.PAUSED) {
        this.closePauseMenu();
      } else if (this.state === BoardState.IDLE) {
        this.openPauseMenu();
      }
    }

    if (this.state === BoardState.GAME_OVER) {
      if (this.restartKey && Phaser.Input.Keyboard.JustDown(this.restartKey)) {
        this.scene.restart({ speedMode: this.speedMode });
        return;
      }
      this.layoutAllTiles();
      this.refreshUi();
      return;
    }
    if (this.state === BoardState.PAUSED) {
      this.layoutAllTiles();
      this.refreshUi();
      return;
    }

    const deltaSeconds = delta / 1000;
    const scoreValue = Math.floor(this.score);
    if (scoreValue > this.highScore) {
      this.highScore = scoreValue;
      localStorage.setItem(HIGH_SCORE_KEY, String(scoreValue));
    }

    if (this.state === BoardState.IDLE) {
      if (this.riseDelayLeft > 0) {
        this.riseDelayLeft -= deltaSeconds;
      } else {
        if (this.speedMode === 'time') {
          this.elapsedSeconds += deltaSeconds;
        }
        const speed = this.getRiseSpeed();

        this.risingOffset += speed * deltaSeconds;

        while (this.risingOffset >= TILE_SIZE) {
          this.risingOffset -= TILE_SIZE;
          this.applyRiseStep();
        }

        this.checkDangerLine();
      }
    }

    this.layoutAllTiles();
    this.refreshUi();
  }

  private drawSceneDecor(): void {
    for (let i = 0; i < 35; i += 1) {
      this.add.circle(
        Phaser.Math.Between(0, this.scale.width),
        Phaser.Math.Between(16, this.scale.height - 16),
        Phaser.Math.Between(1, 3),
        0x7dd3fc,
        Phaser.Math.FloatBetween(0.04, 0.12),
      );
    }
  }

  private drawBoardFrame(): void {
    const boardWidth = GRID_COLS * TILE_SIZE;
    const boardHeight = GRID_ROWS * TILE_SIZE;

    this.add
      .rectangle(BOARD_X + boardWidth / 2, BOARD_Y + boardHeight / 2, boardWidth + 30, boardHeight + 132, 0x0b1220, 0.58)
      .setStrokeStyle(2, 0x1f2d45, 0.5);

    this.add
      .rectangle(BOARD_X + boardWidth / 2, BOARD_Y + boardHeight / 2, boardWidth + 10, boardHeight + 10, 0x000000, 0.25)
      .setStrokeStyle(1, 0x364b6b, 0.35);

    this.add.rectangle(BOARD_X + boardWidth / 2, BOARD_Y + boardHeight / 2, boardWidth, boardHeight, 0x000000, 0.25);
  }

  private createBoardMask(): void {
    const maskGraphics = this.make.graphics({ x: 0, y: 0 }, false);
    maskGraphics.fillRect(BOARD_X, BOARD_Y, GRID_COLS * TILE_SIZE, GRID_ROWS * TILE_SIZE);
    this.boardMask = maskGraphics.createGeometryMask();
  }

  private createHud(): void {
    this.add.rectangle(118, 24, 210, 48, 0x14301a, 0.48).setStrokeStyle(1, 0x5d8f51, 0.6);
    const pauseBtn = this.add
      .rectangle(BOARD_X + GRID_COLS * TILE_SIZE - 20, 24, 34, 22, 0xfffdf7, 1)
      .setStrokeStyle(1, 0xd5c3a5, 1)
      .setInteractive({ useHandCursor: true });
    const pauseText = this.add
      .text(BOARD_X + GRID_COLS * TILE_SIZE - 20, 24, 'II', {
        fontFamily: HUD_FONT,
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#3a2d1d',
      })
      .setOrigin(0.5)
      .setScale(0.5);

    pauseBtn.on('pointerdown', () => {
      if (this.state === BoardState.IDLE) {
        this.openPauseMenu();
      } else if (this.state === BoardState.PAUSED) {
        this.closePauseMenu();
      }
    });
    pauseBtn.on('pointerover', () => pauseBtn.setFillStyle(0xfff0d4, 1));
    pauseBtn.on('pointerout', () => pauseBtn.setFillStyle(0xfffdf7, 1));
    pauseText.setDepth(pauseBtn.depth + 1);

    this.scoreText = this.add
      .text(16, 8, '', {
        fontFamily: HUD_FONT,
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#f6fff2',
        resolution: 2,
      })
      .setScale(0.5);

    this.highScoreText = this.add
      .text(16, 34, '', {
        fontFamily: HUD_FONT,
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#f9d879',
        resolution: 2,
      })
      .setScale(0.5);

    this.helperText = this.add
      .text(16, BOARD_Y + GRID_ROWS * TILE_SIZE + 10, 'Pick any 3 matching fruits', {
        fontFamily: HUD_FONT,
        fontSize: '24px',
        color: '#f0fff2',
        resolution: 2,
      })
      .setScale(0.5);
  }

  private createDangerLine(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(3, 0xff5a64, 1);
    graphics.beginPath();
    graphics.moveTo(BOARD_X, DANGER_LINE_Y);
    graphics.lineTo(BOARD_X + GRID_COLS * TILE_SIZE, DANGER_LINE_Y);
    graphics.strokePath();

    this.add
      .text(BOARD_X + GRID_COLS * TILE_SIZE - 82, DANGER_LINE_Y - 20, 'DANGER', {
        fontFamily: HUD_FONT,
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ff6c74',
        resolution: 2,
      })
      .setScale(0.5);
  }

  private openPauseMenu(): void {
    if (this.state !== BoardState.IDLE || this.pauseOverlay) {
      return;
    }

    this.state = BoardState.PAUSED;
    this.selectedTiles = [];
    this.paintSelection();

    const centerX = BOARD_X + (GRID_COLS * TILE_SIZE) / 2;
    const centerY = BOARD_Y + (GRID_ROWS * TILE_SIZE) / 2;

    const blocker = this.add
      .rectangle(centerX, centerY, GRID_COLS * TILE_SIZE + 28, GRID_ROWS * TILE_SIZE + 132, 0x05090f, 0.62)
      .setInteractive();
    blocker.on('pointerdown', () => {
      // keep clicks from passing through to board while paused
    });

    const panel = this.add
      .rectangle(centerX, centerY, GRID_COLS * TILE_SIZE - 20, 190, 0x0b1624, 0.95)
      .setStrokeStyle(2, 0x5d8f51, 0.85);

    const title = this.add
      .text(centerX, centerY - 66, 'Paused', {
        fontFamily: HUD_FONT,
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#f4f8ff',
      })
      .setOrigin(0.5)
      .setScale(0.5);

    const resume = this.createPauseButton(centerX, centerY - 20, 'Resume', () => this.closePauseMenu());
    const menu = this.createPauseButton(centerX, centerY + 20, 'Main Menu', () => this.scene.start('MenuScene'));
    const exit = this.createPauseButton(centerX, centerY + 60, 'Exit Game', () => this.scene.start('ExitScene'));

    this.pauseOverlay = this.add.container(0, 0, [blocker, panel, title, resume, menu, exit]);
    this.pauseOverlay.setDepth(1000);
  }

  private closePauseMenu(): void {
    if (!this.pauseOverlay || this.state !== BoardState.PAUSED) {
      return;
    }
    this.pauseOverlay.destroy(true);
    this.pauseOverlay = undefined;
    this.state = BoardState.IDLE;
  }

  private createPauseButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const bg = this.add
      .rectangle(x, y, 170, 30, 0xfffdf7, 1)
      .setStrokeStyle(2, 0xd5c3a5, 1)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, {
        fontFamily: HUD_FONT,
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#3a2d1d',
      })
      .setOrigin(0.5)
      .setScale(0.5);

    bg.on('pointerover', () => bg.setFillStyle(0xfff0d4, 1));
    bg.on('pointerout', () => bg.setFillStyle(0xfffdf7, 1));
    bg.on('pointerdown', () => onClick());

    return this.add.container(0, 0, [bg, text]);
  }

  private createTile(kind: TileKind, col: number, row: number): Tile {
    const tileW = TILE_SIZE - 8;
    const tileH = TILE_SIZE - 8;
    const shadow = this.add.rectangle(0, 5, tileW, tileH, 0xd5c3a5, 1);
    const bg = this.add.rectangle(0, 0, tileW, tileH, 0xfffdf7, 1).setStrokeStyle(1, 0xffffff, 1);
    const shine = this.add.rectangle(0, -tileH * 0.26, tileW - 10, 11, 0xffffff, 0.45);

    const text = this.add
      .text(0, 1, TILE_EMOJIS[kind], {
        fontFamily: EMOJI_FONT_FAMILY,
        fontSize: '32px',
      })
      .setOrigin(0.5);

    const container = this.add.container(0, 0, [shadow, bg, shine, text]);
    container.setMask(this.boardMask);

    const tile: Tile = {
      id: this.tileIdCounter,
      kind,
      col,
      row,
      container,
      shadow,
      bg,
      shine,
      text,
    };

    this.tileIdCounter += 1;

    bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.handleTileClick(tile);
    });

    this.paintTile(tile, false);
    this.positionTile(tile);
    return tile;
  }

  private ensureFxTextures(): void {
    if (this.textures.exists(this.popParticleTextureKey)) {
      return;
    }

    const dot = this.make.graphics({ x: 0, y: 0 }, false);
    dot.fillStyle(0xffffff, 1);
    dot.fillCircle(4, 4, 4);
    dot.generateTexture(this.popParticleTextureKey, 8, 8);
    dot.destroy();
  }

  private handleTileClick(tile: Tile): void {
    if (this.state !== BoardState.IDLE) {
      return;
    }
    if (!this.isTileInGrid(tile)) {
      return;
    }

    this.playTilePressAnim(tile);

    const selectedIndex = this.selectedTiles.findIndex((candidate) => candidate.id === tile.id);
    if (selectedIndex >= 0) {
      this.selectedTiles.splice(selectedIndex, 1);
      this.paintSelection();
      return;
    }

    if (this.selectedTiles.length > 0 && this.selectedTiles[0].kind !== tile.kind) {
      this.selectedTiles = [tile];
      this.paintSelection();
      return;
    }

    if (this.selectedTiles.length >= 3) {
      this.selectedTiles = [tile];
      this.paintSelection();
      return;
    }

    this.selectedTiles.push(tile);
    this.paintSelection();

    if (this.selectedTiles.length === 3) {
      const liveSelection = this.selectedTiles.filter((entry) => this.isTileInGrid(entry));
      if (liveSelection.length !== 3) {
        this.selectedTiles = liveSelection;
        this.paintSelection();
        return;
      }

      const selectedMatch = new Set(liveSelection);
      this.selectedTiles = [];
      this.paintSelection();
      void this.resolveMatches(selectedMatch);
    }
  }

  private checkMatches(): Set<Tile> {
    const matches = new Set<Tile>();

    for (let row = 0; row < GRID_ROWS; row += 1) {
      let streakKind = -1;
      let streakStart = 0;
      let streakCount = 0;

      for (let col = 0; col <= GRID_COLS; col += 1) {
        const tile = col < GRID_COLS ? this.grid[row][col] : null;
        const kind = tile?.kind ?? -2;

        if (kind === streakKind && tile !== null) {
          streakCount += 1;
        } else {
          if (streakCount >= 3 && streakKind >= 0) {
            for (let c = streakStart; c < streakStart + streakCount; c += 1) {
              const hit = this.grid[row][c];
              if (hit) {
                matches.add(hit);
              }
            }
          }

          streakKind = tile?.kind ?? -1;
          streakStart = col;
          streakCount = tile ? 1 : 0;
        }
      }
    }

    for (let col = 0; col < GRID_COLS; col += 1) {
      let streakKind = -1;
      let streakStart = 0;
      let streakCount = 0;

      for (let row = 0; row <= GRID_ROWS; row += 1) {
        const tile = row < GRID_ROWS ? this.grid[row][col] : null;
        const kind = tile?.kind ?? -2;

        if (kind === streakKind && tile !== null) {
          streakCount += 1;
        } else {
          if (streakCount >= 3 && streakKind >= 0) {
            for (let r = streakStart; r < streakStart + streakCount; r += 1) {
              const hit = this.grid[r][col];
              if (hit) {
                matches.add(hit);
              }
            }
          }

          streakKind = tile?.kind ?? -1;
          streakStart = row;
          streakCount = tile ? 1 : 0;
        }
      }
    }

    return matches;
  }

  private async resolveMatches(matches: Set<Tile>): Promise<void> {
    this.state = BoardState.MATCHING;
    let poppedCount = 0;
    let popCenterX = 0;
    let popCenterY = 0;

    matches.forEach((tile) => {
      if (!this.isTileInGrid(tile)) {
        return;
      }

      const rowData = this.grid[tile.row];
      const gridTile = rowData[tile.col];
      if (!gridTile || gridTile.id !== tile.id) {
        return;
      }

      rowData[tile.col] = null;
      poppedCount += 1;
      popCenterX += this.getTileCenterX(gridTile.col);
      popCenterY += this.getTileCenterY(gridTile.row);

      this.playTilePopAnim(gridTile);
    });

    if (poppedCount === 0) {
      this.state = BoardState.IDLE;
      return;
    }

    const gainedScore = poppedCount * SCORE_PER_TILE;
    this.score += gainedScore;
    this.spawnFloatingScore(popCenterX / poppedCount, popCenterY / poppedCount, gainedScore);
    this.playPopSound(poppedCount);
    this.cameras.main.shake(65, Math.min(0.0032, 0.0012 + poppedCount * 0.00028));

    await this.delay(CLEAR_DELAY + 20);
    await this.dropTiles();

    const cascadeMatches = this.checkMatches();
    if (cascadeMatches.size > 0) {
      await this.resolveMatches(cascadeMatches);
      return;
    }

    this.state = BoardState.IDLE;
  }

  private async dropTiles(): Promise<void> {
    this.state = BoardState.DROPPING;

    const movingTiles: Tile[] = [];

    for (let col = 0; col < GRID_COLS; col += 1) {
      let writeRow = GRID_ROWS - 1;

      for (let row = GRID_ROWS - 1; row >= 0; row -= 1) {
        const tile = this.grid[row][col];
        if (!tile) {
          continue;
        }

        if (writeRow !== row) {
          this.grid[writeRow][col] = tile;
          this.grid[row][col] = null;
          tile.row = writeRow;
          movingTiles.push(tile);
        }

        writeRow -= 1;
      }

      while (writeRow >= 0) {
        this.grid[writeRow][col] = null;
        writeRow -= 1;
      }
    }

    if (movingTiles.length === 0) {
      return;
    }

    await this.tweenTiles(movingTiles, DROP_DURATION);
  }

  private spawnNewRow(): Tile[] {
    const row: Tile[] = [];

    for (let col = 0; col < GRID_COLS; col += 1) {
      const kind = Phaser.Math.Between(0, TILE_EMOJIS.length - 1);
      const tile = this.createTile(kind, col, GRID_ROWS);
      row.push(tile);
    }

    return row;
  }

  private applyRiseStep(): void {
    const outgoingTop = this.grid[0];

    for (let col = 0; col < GRID_COLS; col += 1) {
      outgoingTop[col]?.container.destroy();
    }

    for (let row = 0; row < GRID_ROWS - 1; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const tile = this.grid[row + 1][col];
        this.grid[row][col] = tile;
        if (tile) {
          tile.row = row;
        }
      }
    }

    for (let col = 0; col < GRID_COLS; col += 1) {
      const tile = this.pendingRow[col];
      tile.row = GRID_ROWS - 1;
      this.grid[GRID_ROWS - 1][col] = tile;
    }

    this.pendingRow = this.spawnNewRow();
    this.pruneSelection();
  }

  private checkDangerLine(): void {
    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const tile = this.grid[row][col];
        if (!tile) {
          continue;
        }

        const tileTopY = this.getTileTopY(tile.row);
        if (tileTopY <= DANGER_LINE_Y) {
          this.triggerGameOver();
          return;
        }
      }
    }
  }

  private triggerGameOver(): void {
    if (this.pauseOverlay) {
      this.pauseOverlay.destroy(true);
      this.pauseOverlay = undefined;
    }
    this.state = BoardState.GAME_OVER;

    const finalScore = Math.floor(this.score);
    if (finalScore > this.highScore) {
      this.highScore = finalScore;
      localStorage.setItem(HIGH_SCORE_KEY, String(finalScore));
    }

    const centerX = BOARD_X + (GRID_COLS * TILE_SIZE) / 2;
    const centerY = BOARD_Y + (GRID_ROWS * TILE_SIZE) / 2;

    this.add
      .rectangle(centerX, centerY, GRID_COLS * TILE_SIZE - 20, 156, 0x0a1628, 0.92)
      .setStrokeStyle(2, 0xef4444, 1);

    this.add
      .text(centerX, centerY - 36, 'Game Over', {
        fontFamily: HUD_FONT,
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#ff6b74',
        resolution: 2,
      })
      .setOrigin(0.5)
      .setScale(0.5);

    this.add
      .text(centerX, centerY - 2, `Score: ${Math.floor(this.score)}`, {
        fontFamily: HUD_FONT,
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#f8fafc',
        resolution: 2,
      })
      .setOrigin(0.5)
      .setScale(0.5);

    this.add
      .text(centerX, centerY + 24, 'Press R or Click to Restart', {
        fontFamily: HUD_FONT,
        fontSize: '22px',
        color: '#9ed7ff',
        resolution: 2,
      })
      .setOrigin(0.5)
      .setScale(0.5);

    this.input.once('pointerdown', () => {
      this.scene.restart({ speedMode: this.speedMode });
    });
  }

  private pickNonMatchingKind(row: number, col: number): TileKind {
    const options = Phaser.Utils.Array.NumberArray(0, TILE_EMOJIS.length - 1) as TileKind[];

    return Phaser.Utils.Array.GetRandom(
      options.filter((kind) => {
        const left1 = col > 0 ? this.grid[row]?.[col - 1] : null;
        const left2 = col > 1 ? this.grid[row]?.[col - 2] : null;
        const up1 = row > 0 ? this.grid[row - 1]?.[col] : null;
        const up2 = row > 1 ? this.grid[row - 2]?.[col] : null;

        const makesHorizontal = left1?.kind === kind && left2?.kind === kind;
        const makesVertical = up1?.kind === kind && up2?.kind === kind;

        return !makesHorizontal && !makesVertical;
      }),
    );
  }

  private layoutAllTiles(): void {
    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const tile = this.grid[row][col];
        if (tile) {
          this.positionTile(tile);
        }
      }
    }

    for (const tile of this.pendingRow) {
      this.positionTile(tile);
    }
  }

  private positionTile(tile: Tile): void {
    tile.container.x = this.getTileCenterX(tile.col);
    tile.container.y = this.getTileCenterY(tile.row);
  }

  private getTileCenterX(col: number): number {
    return BOARD_X + col * TILE_SIZE + TILE_SIZE / 2;
  }

  private getTileCenterY(row: number): number {
    return BOARD_Y + row * TILE_SIZE + TILE_SIZE / 2 - this.risingOffset;
  }

  private getTileTopY(row: number): number {
    return BOARD_Y + row * TILE_SIZE - this.risingOffset;
  }

  private getRiseSpeed(): number {
    const progress = this.speedMode === 'time' ? this.elapsedSeconds : this.score / 25;
    return Math.min(RISE_SPEED_START + progress * RISE_SPEED_ACCEL, RISE_SPEED_MAX);
  }

  private refreshUi(): void {
    this.scoreText.setText(`Score: ${Math.floor(this.score)}`);
    this.highScoreText.setText(`High Score: ${this.highScore}`);

    if (this.state === BoardState.GAME_OVER) {
      this.helperText.setText('Tap board or press R to play again');
      return;
    }

    if (this.selectedTiles.length > 0) {
      this.helperText.setText(`${this.selectedTiles.length}/3 selected`);
      return;
    }

    const label = this.speedMode === 'time' ? 'Time Mode' : 'Score Mode';
    this.helperText.setText(`Pick any 3 matching fruits (${label})`);
  }

  private paintSelection(): void {
    this.clearSelectionPaint();

    for (const tile of this.selectedTiles) {
      this.paintTile(tile, true);
    }
  }

  private clearSelectionPaint(): void {
    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const tile = this.grid[row][col];
        if (tile) {
          this.paintTile(tile, false);
        }
      }
    }
  }

  private paintTile(tile: Tile, selected: boolean): void {
    if (selected) {
      tile.bg.setFillStyle(0xfff0d4, 1);
      tile.bg.setStrokeStyle(1, 0xe6dcc0, 1);
      tile.bg.y = 5;
      tile.text.y = 6;
      tile.shine.y = -9;
      tile.shine.alpha = 0.2;
      tile.shadow.y = 0;
      tile.shadow.alpha = 0;
      tile.container.setScale(1.06);
      return;
    }

    tile.bg.setFillStyle(0xfffdf7, 1);
    tile.bg.setStrokeStyle(1, 0xffffff, 1);
    tile.bg.y = 0;
    tile.text.y = 1;
    tile.shine.y = -(TILE_SIZE - 8) * 0.26;
    tile.shine.alpha = 0.45;
    tile.shadow.y = 5;
    tile.shadow.alpha = 1;
    tile.container.setScale(1);
  }

  private playTilePressAnim(tile: Tile): void {
    this.tweens.killTweensOf(tile.container);
    const baseScale = tile.container.scaleX;
    this.tweens.add({
      targets: tile.container,
      scaleX: baseScale * 0.92,
      scaleY: baseScale * 0.92,
      duration: 55,
      ease: 'Quad.Out',
      yoyo: true,
      onComplete: () => {
        if (this.selectedTiles.some((selected) => selected.id === tile.id)) {
          this.paintTile(tile, true);
        } else {
          this.paintTile(tile, false);
        }
      },
    });
  }

  private spawnFloatingScore(x: number, y: number, gainedScore: number): void {
    const popup = this.add
      .text(x, y, `+${gainedScore}`, {
        fontFamily: HUD_FONT,
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#ffe082',
        stroke: '#5e3a00',
        strokeThickness: 4,
        resolution: 2,
      })
      .setOrigin(0.5)
      .setScale(0.5)
      .setDepth(20);

    popup.setMask(this.boardMask);

    this.tweens.add({
      targets: popup,
      y: y - 28,
      alpha: 0,
      scaleX: 0.62,
      scaleY: 0.62,
      duration: 520,
      ease: 'Cubic.Out',
      onComplete: () => popup.destroy(),
    });
  }

  private playTilePopAnim(tile: Tile): void {
    const x = this.getTileCenterX(tile.col);
    const y = this.getTileCenterY(tile.row);
    this.emitPopParticles(x, y);

    this.tweens.killTweensOf(tile.container);
    this.tweens.add({
      targets: tile.container,
      scaleX: 1.12,
      scaleY: 0.86,
      duration: 45,
      ease: 'Quad.Out',
      onComplete: () => {
        this.tweens.add({
          targets: tile.container,
          scaleX: 1.35,
          scaleY: 1.35,
          alpha: 0,
          angle: Phaser.Math.Between(-16, 16),
          y: y - 6,
          duration: CLEAR_DELAY,
          ease: 'Back.In',
          onComplete: () => tile.container.destroy(),
        });
      },
    });
  }

  private emitPopParticles(x: number, y: number): void {
    const emitter = this.add.particles(x, y, this.popParticleTextureKey, {
      lifespan: { min: 130, max: 260 },
      speed: { min: 55, max: 190 },
      angle: { min: 0, max: 360 },
      quantity: 10,
      scale: { start: 0.65, end: 0 },
      alpha: { start: 0.95, end: 0 },
      gravityY: 180,
      emitting: false,
      blendMode: Phaser.BlendModes.ADD,
      tint: [0xffffff, 0xfff0c4, 0xffd18b],
    });

    emitter.explode(10, x, y);
    this.time.delayedCall(320, () => emitter.destroy());
  }

  private pruneSelection(): void {
    const liveIds = new Set<number>();
    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const tile = this.grid[row][col];
        if (tile) {
          liveIds.add(tile.id);
        }
      }
    }

    this.selectedTiles = this.selectedTiles.filter((tile) => liveIds.has(tile.id));
    this.paintSelection();
  }

  private isTileInGrid(tile: Tile): boolean {
    if (tile.row < 0 || tile.row >= GRID_ROWS || tile.col < 0 || tile.col >= GRID_COLS) {
      return false;
    }

    const rowData = this.grid[tile.row];
    if (!rowData) {
      return false;
    }

    return rowData[tile.col]?.id === tile.id;
  }

  private tweenTiles(tiles: Tile[], duration: number): Promise<void> {
    return new Promise((resolve) => {
      if (tiles.length === 0) {
        resolve();
        return;
      }

      const uniqueTiles = Array.from(new Set(tiles));
      let finished = 0;

      for (const tile of uniqueTiles) {
        this.tweens.add({
          targets: tile.container,
          x: this.getTileCenterX(tile.col),
          y: this.getTileCenterY(tile.row),
          duration,
          ease: 'Cubic.Out',
          onComplete: () => {
            finished += 1;
            if (finished === uniqueTiles.length) {
              resolve();
            }
          },
        });
      }
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, () => resolve());
    });
  }

  private playPopSound(popCount: number): void {
    if (!this.popSoundEnabled || popCount <= 0) {
      return;
    }

    const manager = this.sound as Phaser.Sound.WebAudioSoundManager;
    const ctx = manager?.context;
    if (!ctx) {
      return;
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    const burstCount = Math.min(4, Math.max(1, Math.ceil(popCount / 3)));

    for (let i = 0; i < burstCount; i += 1) {
      const start = now + i * 0.035;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.value = 680 + i * 110;
      filter.Q.value = 0.65;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(210 + i * 35, start);
      osc.frequency.exponentialRampToValueAtTime(95 + i * 14, start + 0.08);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.11);
    }
  }

  private resetRunState(): void {
    this.grid = [];
    this.pendingRow = [];
    this.selectedTiles = [];
    this.state = BoardState.IDLE;
    this.risingOffset = 0;
    this.elapsedSeconds = 0;
    this.riseDelayLeft = RISE_START_DELAY_SECONDS;
    this.score = 0;
    this.tileIdCounter = 0;
    this.restartKey = undefined;
    this.pauseKey = undefined;
    this.escKey = undefined;
    this.pauseOverlay = undefined;
  }
}

