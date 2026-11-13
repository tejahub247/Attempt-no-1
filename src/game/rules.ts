import {
  cellKey,
  findColorCluster,
  findFloatingBubbles,
  findRainbowMatches,
  getColsForRow,
  getNeighbors,
  MAX_GRID_ROWS,
} from './hexGrid';
import {
  ActiveShotKind,
  BubbleColor,
  GridBubble,
  LevelConfig,
  PlayerProgress,
  PowerUpType,
} from './types';

import { getPreviousDateKey } from './dailyChallenge';

export const PROGRESS_STORAGE_KEY = 'prism_cat_bubble_shooter_v1';

export const POWER_UP_COSTS: Record<PowerUpType, number> = {
  bomb: 60,
  rainbow: 70,
  fire: 80,
  lightning: 85,
  extraMoves: 50,
};

export function createDefaultProgress(): PlayerProgress {
  return {
    unlockedLevel: 1,
    currentLevel: 1,
    coins: 120,
    levelStats: {},
    dailyChallenge: {
      completedDates: [],
      lastCompletedDate: null,
      streak: 0,
      bestScore: 0,
    },
    powerUps: {
      bomb: 3,
      rainbow: 3,
      fire: 2,
      lightning: 2,
      extraMoves: 3,
    },
    soundEnabled: true,
    musicEnabled: true,
    aimGuideEnabled: true,
  };
}

export function loadProgress(): PlayerProgress {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultProgress();
  }
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return createDefaultProgress();
    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    const defaults = createDefaultProgress();
    return {
      unlockedLevel: Math.max(1, Math.min(100, parsed.unlockedLevel ?? 1)),
      currentLevel: Math.max(1, Math.min(100, parsed.currentLevel ?? 1)),
      coins: Math.max(0, parsed.coins ?? defaults.coins),
      levelStats: parsed.levelStats ?? {},
      dailyChallenge: {
        ...defaults.dailyChallenge,
        ...(parsed.dailyChallenge ?? {}),
      },
      powerUps: { ...defaults.powerUps, ...(parsed.powerUps ?? {}) },
      soundEnabled: parsed.soundEnabled ?? true,
      musicEnabled: parsed.musicEnabled ?? true,
      aimGuideEnabled: parsed.aimGuideEnabled ?? true,
    };
  } catch {
    return createDefaultProgress();
  }
}

export function saveProgress(progress: PlayerProgress): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors
  }
}

export function calculateStarRating(
  score: number,
  targetScores: [number, number, number]
): number {
  if (score >= targetScores[2]) return 3;
  if (score >= targetScores[1]) return 2;
  if (score >= targetScores[0]) return 1;
  return 1; // Clearing a level always awards at least 1 star
}

export function calculatePopScore(
  poppedCount: number,
  droppedCount: number,
  comboStreak: number
): number {
  const comboMultiplier = 1 + Math.min(comboStreak, 6) * 0.25;
  const popPoints = poppedCount * 100 * comboMultiplier;
  const dropPoints = droppedCount * 180 * comboMultiplier;
  return Math.round(popPoints + dropPoints);
}

export function calculateRemainingMovesBonus(movesLeft: number): number {
  return Math.max(0, movesLeft) * 150;
}

export function getAvailableBoardColors(
  grid: Map<string, GridBubble>,
  fallbackColors: BubbleColor[]
): BubbleColor[] {
  const present = new Set<BubbleColor>();
  for (const b of grid.values()) {
    if (b.kind === 'color' && b.color) {
      present.add(b.color);
    }
  }
  return present.size > 0 ? Array.from(present) : fallbackColors;
}

export function pickNextBubbleColor(
  grid: Map<string, GridBubble>,
  levelColors: BubbleColor[],
  rng: () => number = Math.random
): BubbleColor {
  const available = getAvailableBoardColors(grid, levelColors);
  return available[Math.floor(rng() * available.length)];
}

export interface ShotResolution {
  popped: GridBubble[];
  dropped: GridBubble[];
  pointsEarned: number;
  boardCleared: boolean;
  gameOverByOverflow: boolean;
}

/**
 * Resolve landing a shot on (row, col) in the grid map (mutates grid map cleanly).
 */
export function resolveShotOnGrid(
  grid: Map<string, GridBubble>,
  shot: ActiveShotKind,
  landRow: number,
  landCol: number,
  nextId: number,
  comboStreak: number
): ShotResolution {
  const poppedMap = new Map<string, GridBubble>();

  if (shot.kind === 'bomb') {
    // Radius-2 explosion around (landRow, landCol) including stones!
    const ring1 = getNeighbors(landRow, landCol);
    const blastCells = new Map<string, { row: number; col: number }>();
    blastCells.set(cellKey(landRow, landCol), { row: landRow, col: landCol });
    for (const n1 of ring1) {
      blastCells.set(cellKey(n1.row, n1.col), n1);
      for (const n2 of getNeighbors(n1.row, n1.col)) {
        blastCells.set(cellKey(n2.row, n2.col), n2);
      }
    }
    for (const key of blastCells.keys()) {
      const target = grid.get(key);
      if (target) {
        poppedMap.set(key, target);
        grid.delete(key);
      }
    }
  } else if (shot.kind === 'fire') {
    // Fire Bubble destroys the entire horizontal row at landRow (and adjacent row above if empty)
    const cols = getColsForRow(landRow);
    for (let c = 0; c < cols; c++) {
      const k = cellKey(landRow, c);
      const target = grid.get(k);
      if (target) {
        poppedMap.set(k, target);
        grid.delete(k);
      }
    }
    // Also scorch direct hit neighbor row above so it feels explosive vertically too
    if (landRow > 0) {
      const aboveCols = getColsForRow(landRow - 1);
      for (let dc = -1; dc <= 1; dc++) {
        const c = landCol + dc;
        if (c >= 0 && c < aboveCols) {
          const k = cellKey(landRow - 1, c);
          const target = grid.get(k);
          if (target) {
            poppedMap.set(k, target);
            grid.delete(k);
          }
        }
      }
    }
  } else if (shot.kind === 'lightning') {
    // Lightning arcs across the target row + up to 6 random bubbles of the nearest color
    let targetColor: BubbleColor | null = null;
    for (const n of getNeighbors(landRow, landCol)) {
      const nb = grid.get(cellKey(n.row, n.col));
      if (nb && nb.kind === 'color' && nb.color) {
        targetColor = nb.color;
        break;
      }
    }
    // Clear neighbors around impact
    for (const n of getNeighbors(landRow, landCol)) {
      const nk = cellKey(n.row, n.col);
      const nb = grid.get(nk);
      if (nb) {
        poppedMap.set(nk, nb);
        grid.delete(nk);
      }
    }
    // Plus arc to up to 7 bubbles of the struck color anywhere on the board
    if (targetColor) {
      let struck = 0;
      for (const [k, b] of Array.from(grid.entries())) {
        if (b.kind === 'color' && b.color === targetColor) {
          poppedMap.set(k, b);
          grid.delete(k);
          struck++;
          if (struck >= 7) break;
        }
      }
    }
  } else if (shot.kind === 'rainbow') {
    const placed: GridBubble = {
      id: nextId,
      row: landRow,
      col: landCol,
      kind: 'color',
      color: 'cyan', // visual placeholder; findRainbowMatches treats it as wildcard
    };
    grid.set(cellKey(landRow, landCol), placed);
    const matches = findRainbowMatches(landRow, landCol, grid);
    if (matches.length > 0) {
      for (const b of matches) {
        const k = cellKey(b.row, b.col);
        poppedMap.set(k, b);
        grid.delete(k);
      }
    } else {
      // At minimum, rainbow pops itself and nearest neighbor so it's never wasted
      poppedMap.set(cellKey(landRow, landCol), placed);
      grid.delete(cellKey(landRow, landCol));
      for (const n of getNeighbors(landRow, landCol)) {
        const nk = cellKey(n.row, n.col);
        const nb = grid.get(nk);
        if (nb && nb.kind === 'color') {
          poppedMap.set(nk, nb);
          grid.delete(nk);
          break;
        }
      }
    }
  } else {
    // Standard color bubble
    const placed: GridBubble = {
      id: nextId,
      row: landRow,
      col: landCol,
      kind: 'color',
      color: shot.color,
    };
    grid.set(cellKey(landRow, landCol), placed);
    const cluster = findColorCluster(landRow, landCol, shot.color, grid);
    if (cluster.length >= 3) {
      for (const b of cluster) {
        const k = cellKey(b.row, b.col);
        poppedMap.set(k, b);
        grid.delete(k);
      }
    }
  }

  // Drop any floating disconnected bubbles
  const floating = findFloatingBubbles(grid);
  for (const b of floating) {
    grid.delete(cellKey(b.row, b.col));
  }

  const popped = Array.from(poppedMap.values());
  const pointsEarned =
    popped.length > 0 || floating.length > 0
      ? calculatePopScore(popped.length, floating.length, comboStreak)
      : 0;

  // Board is cleared when NO colored bubbles remain (remaining floating stones drop above, or if only stones remain on row 0, clear them too)
  let remainingColorCount = 0;
  let maxRow = -1;
  for (const b of grid.values()) {
    if (b.kind === 'color') remainingColorCount++;
    if (b.row > maxRow) maxRow = b.row;
  }

  const boardCleared = remainingColorCount === 0;
  const gameOverByOverflow = !boardCleared && maxRow >= MAX_GRID_ROWS - 2;

  return {
    popped,
    dropped: floating,
    pointsEarned,
    boardCleared,
    gameOverByOverflow,
  };
}

export function buildGridFromLevel(level: LevelConfig): Map<string, GridBubble> {
  const grid = new Map<string, GridBubble>();
  let idCounter = 1;
  for (const cell of level.initialCells) {
    grid.set(cellKey(cell.row, cell.col), {
      id: idCounter++,
      row: cell.row,
      col: cell.col,
      kind: cell.kind,
      color: cell.color,
    });
  }
  return grid;
}

export function recordLevelVictory(
  progress: PlayerProgress,
  levelNumber: number,
  finalScore: number,
  starsEarned: number
): PlayerProgress {
  const prev = progress.levelStats[levelNumber];
  const bestScore = Math.max(prev?.bestScore ?? 0, finalScore);
  const stars = Math.max(prev?.stars ?? 0, starsEarned);

  const nextUnlocked = Math.max(
    progress.unlockedLevel,
    Math.min(100, levelNumber + 1)
  );

  // Award small power-up refill bonus on milestone levels (every 5 levels)
  const powerUps = { ...progress.powerUps };
  if (levelNumber % 5 === 0 && !prev) {
    powerUps.bomb += 1;
    powerUps.rainbow += 1;
    powerUps.extraMoves += 1;
  }

  // Earn star gems on win (more on first clear)
  const coinReward = (!prev ? 30 : 10) + starsEarned * 10;

  return {
    ...progress,
    unlockedLevel: nextUnlocked,
    currentLevel: Math.min(100, levelNumber + 1),
    coins: progress.coins + coinReward,
    levelStats: {
      ...progress.levelStats,
      [levelNumber]: { stars, bestScore },
    },
    powerUps,
  };
}

export function recordDailyChallengeVictory(
  progress: PlayerProgress,
  dateKey: string,
  finalScore: number,
  rewardCoins: number
): { progress: PlayerProgress; coinsAwarded: number; isFirstToday: boolean } {
  const alreadyCompleted = progress.dailyChallenge.completedDates.includes(dateKey);
  const prevDay = getPreviousDateKey(dateKey);
  const nextStreak = alreadyCompleted
    ? progress.dailyChallenge.streak
    : progress.dailyChallenge.lastCompletedDate === prevDay
    ? progress.dailyChallenge.streak + 1
    : 1;

  const streakBonus = !alreadyCompleted && nextStreak > 1 ? Math.min(nextStreak * 25, 150) : 0;
  const coinsAwarded = alreadyCompleted ? 25 : rewardCoins + streakBonus;

  return {
    coinsAwarded,
    isFirstToday: !alreadyCompleted,
    progress: {
      ...progress,
      coins: progress.coins + coinsAwarded,
      dailyChallenge: {
        completedDates: alreadyCompleted
          ? progress.dailyChallenge.completedDates
          : [...progress.dailyChallenge.completedDates, dateKey],
        lastCompletedDate: dateKey,
        streak: nextStreak,
        bestScore: Math.max(progress.dailyChallenge.bestScore, finalScore),
      },
    },
  };
}

export function buyPowerUpWithCoins(
  progress: PlayerProgress,
  type: PowerUpType
): PlayerProgress | null {
  const cost = POWER_UP_COSTS[type];
  if (progress.coins < cost) return null;
  return {
    ...progress,
    coins: progress.coins - cost,
    powerUps: {
      ...progress.powerUps,
      [type]: (progress.powerUps[type] ?? 0) + 1,
    },
  };
}
