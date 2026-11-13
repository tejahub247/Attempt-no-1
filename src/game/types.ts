export type BubbleColor =
  | 'red'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'purple'
  | 'orange'
  | 'pink'
  | 'cyan';

export type PowerUpType = 'bomb' | 'rainbow' | 'fire' | 'lightning' | 'extraMoves';

export type ActiveShotKind =
  | { kind: 'color'; color: BubbleColor }
  | { kind: 'bomb' }
  | { kind: 'rainbow' }
  | { kind: 'fire' }
  | { kind: 'lightning' };

export type CellKind = 'color' | 'stone';

export interface GridBubble {
  id: number;
  row: number;
  col: number;
  kind: CellKind;
  color: BubbleColor | null; // null when kind === 'stone'
  armor?: number; // for armored/barrier stones or special cells
}

export interface ColorSpec {
  id: BubbleColor;
  label: string;
  hex: number;
  css: string;
  glowCss: string;
  emissive: number;
}

export const BUBBLE_COLORS: Record<BubbleColor, ColorSpec> = {
  red: {
    id: 'red',
    label: 'Red',
    hex: 0xff2e54,
    css: '#ff2e54',
    glowCss: 'rgba(255, 46, 84, 0.55)',
    emissive: 0x550816,
  },
  blue: {
    id: 'blue',
    label: 'Blue',
    hex: 0x2979ff,
    css: '#2979ff',
    glowCss: 'rgba(41, 121, 255, 0.55)',
    emissive: 0x062055,
  },
  green: {
    id: 'green',
    label: 'Green',
    hex: 0x00e676,
    css: '#00e676',
    glowCss: 'rgba(0, 230, 118, 0.55)',
    emissive: 0x034522,
  },
  yellow: {
    id: 'yellow',
    label: 'Yellow',
    hex: 0xffd600,
    css: '#ffd600',
    glowCss: 'rgba(255, 214, 0, 0.55)',
    emissive: 0x4d3f00,
  },
  purple: {
    id: 'purple',
    label: 'Purple',
    hex: 0xb339ff,
    css: '#b339ff',
    glowCss: 'rgba(179, 57, 255, 0.55)',
    emissive: 0x350959,
  },
  orange: {
    id: 'orange',
    label: 'Orange',
    hex: 0xff7b00,
    css: '#ff7b00',
    glowCss: 'rgba(255, 123, 0, 0.55)',
    emissive: 0x4d2100,
  },
  pink: {
    id: 'pink',
    label: 'Pink',
    hex: 0xff47b5,
    css: '#ff47b5',
    glowCss: 'rgba(255, 71, 181, 0.55)',
    emissive: 0x4d0b34,
  },
  cyan: {
    id: 'cyan',
    label: 'Cyan',
    hex: 0x00e5ff,
    css: '#00e5ff',
    glowCss: 'rgba(0, 229, 255, 0.55)',
    emissive: 0x004552,
  },
};

export const ALL_BUBBLE_COLOR_IDS: BubbleColor[] = [
  'red',
  'blue',
  'green',
  'yellow',
  'purple',
  'orange',
  'pink',
  'cyan',
];

export type DifficultyTier =
  | 'Tutorial'
  | 'Easy'
  | 'Beginner-Intermediate'
  | 'Medium'
  | 'Challenging'
  | 'Hard'
  | 'Very Hard'
  | 'Expert'
  | 'Extremely Difficult'
  | 'Ultimate Challenge';

export interface LevelConfig {
  levelNumber: number; // 1..100
  tier: DifficultyTier;
  tierIndex: number; // 0..9
  title: string;
  patternName: string;
  colors: BubbleColor[];
  maxMoves: number;
  colsEven: number;
  rows: number;
  targetScores: [number, number, number]; // 1-star, 2-star, 3-star thresholds
  initialCells: Array<{
    row: number;
    col: number;
    kind: CellKind;
    color: BubbleColor | null;
  }>;
  skyTheme: {
    top: string;
    mid: string;
    bottom: string;
    accentHex: number;
  };
  isDailyChallenge?: boolean;
  dailyDateKey?: string;
  specialCondition?: {
    kind: 'limited-moves' | 'specific-colors' | 'stone-fortress' | 'combo-blitz';
    label: string;
    description: string;
  };
  rewardCoins?: number;
  bonusPointsMultiplier?: number;
}

export type ScreenMode =
  | 'splash'
  | 'home'
  | 'levels'
  | 'playing'
  | 'paused'
  | 'victory'
  | 'gameover';

export interface LevelProgressRecord {
  stars: number; // 0..3
  bestScore: number;
}

export interface DailyChallengeRecord {
  completedDates: string[]; // YYYY-MM-DD
  lastCompletedDate: string | null;
  streak: number;
  bestScore: number;
}

export interface PlayerProgress {
  unlockedLevel: number; // 1..100
  currentLevel: number; // 1..100
  coins: number;
  levelStats: Record<number, LevelProgressRecord>;
  dailyChallenge: DailyChallengeRecord;
  powerUps: Record<PowerUpType, number>;
  soundEnabled: boolean;
  musicEnabled: boolean;
  aimGuideEnabled: boolean;
}
