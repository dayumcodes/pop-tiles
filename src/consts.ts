export const GRID_COLS = 7;
export const GRID_ROWS = 10;
export const TILE_SIZE = 62;

export const BOARD_PADDING = 16;
export const UI_HEIGHT = 96;

export const GAME_WIDTH = GRID_COLS * TILE_SIZE + BOARD_PADDING * 2;
export const GAME_HEIGHT = GRID_ROWS * TILE_SIZE + UI_HEIGHT + BOARD_PADDING * 2;

export const BOARD_X = BOARD_PADDING;
export const BOARD_Y = UI_HEIGHT;

export const DANGER_LINE_Y = BOARD_Y + 4;

export const RISE_SPEED_START = 3.2;
export const RISE_SPEED_ACCEL = 0.2;
export const RISE_SPEED_MAX = 14;
export const RISE_START_DELAY_SECONDS = 4;
export const START_EMPTY_ROWS = 4;

export const SWAP_DURATION = 120;
export const DROP_DURATION = 140;
export const CLEAR_DELAY = 80;

export const SCORE_PER_TILE = 10;
export const SCORE_PER_SECOND = 2;

export const HIGH_SCORE_KEY = 'rising-match3-high-score';
export const BALLOON_TILE = '\u{1F388}';

export const EMOJI_FONT_FAMILY =
  '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

export const TILE_EMOJIS = [
  '\u{1F330}',
  '\u{1F34C}',
  '\u{1F4A7}',
  '\u{1F388}',
  '\u{1F347}',
  '\u{1F349}',
  '\u{1F525}',
  '\u{1F48E}',
  '\u{26A1}',
  '\u{1F344}',
  '\u{1F955}',
  '\u{1F52D}',
] as const;
