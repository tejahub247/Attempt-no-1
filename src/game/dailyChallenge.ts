import { getColsForRow } from './hexGrid';
import {
  ALL_BUBBLE_COLOR_IDS,
  BubbleColor,
  CellKind,
  LevelConfig,
} from './types';

function hashDateKey(dateKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getPreviousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return getLocalDateKey(dt);
}

const DAILY_CONDITIONS = [
  {
    kind: 'limited-moves' as const,
    label: 'Precision Quiver',
    description: 'Tight 18-move budget with rich cluster pockets · +150 Gems',
    moves: 18,
    colorCount: 5,
    rows: 7,
    stoneRate: 0.08,
    rewardCoins: 150,
    multiplier: 1.5,
  },
  {
    kind: 'specific-colors' as const,
    label: 'Chromatic Gauntlet',
    description: 'All 8 prism colours active across a deep cascade · +180 Gems',
    moves: 24,
    colorCount: 8,
    rows: 8,
    stoneRate: 0.06,
    rewardCoins: 180,
    multiplier: 1.4,
  },
  {
    kind: 'stone-fortress' as const,
    label: 'Obsidian Bastion',
    description: 'Armored stone barriers guard floating clusters · +200 Gems',
    moves: 22,
    colorCount: 6,
    rows: 8,
    stoneRate: 0.16,
    rewardCoins: 200,
    multiplier: 1.6,
  },
  {
    kind: 'combo-blitz' as const,
    label: 'Solaris Surge',
    description: '4 intense colours, 9 tall rows, 1.75x bonus score · +160 Gems',
    moves: 20,
    colorCount: 4,
    rows: 9,
    stoneRate: 0.1,
    rewardCoins: 160,
    multiplier: 1.75,
  },
];

const DAILY_SKIES = [
  { top: '#130c2e', mid: '#3b175c', bottom: '#8c2b66', accentHex: 0xf472b6 },
  { top: '#061c2e', mid: '#0e496e', bottom: '#178596', accentHex: 0x22d3ee },
  { top: '#240f17', mid: '#631d2d', bottom: '#a8422b', accentHex: 0xfb923c },
  { top: '#0d1936', mid: '#253273', bottom: '#5844a8', accentHex: 0xa78bfa },
];

export function getDailyChallenge(dateOrKey: Date | string = new Date()): LevelConfig {
  const dateKey =
    typeof dateOrKey === 'string' ? dateOrKey : getLocalDateKey(dateOrKey);
  const seed = hashDateKey(`daily-prism-${dateKey}`);
  const rand = mulberry32(seed);

  const condition = DAILY_CONDITIONS[seed % DAILY_CONDITIONS.length];
  const skyTheme = DAILY_SKIES[(seed >>> 3) % DAILY_SKIES.length];

  // Deterministically shuffle bubble colors
  const pool = [...ALL_BUBBLE_COLOR_IDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const colors: BubbleColor[] = pool.slice(0, condition.colorCount);

  const initialCells: Array<{
    row: number;
    col: number;
    kind: CellKind;
    color: BubbleColor | null;
  }> = [];
  const present = new Set<string>();

  const patternMode = (seed >>> 5) % 4;
  for (let r = 0; r < condition.rows; r++) {
    const cols = getColsForRow(r);
    const center = (cols - 1) / 2;
    for (let c = 0; c < cols; c++) {
      const dist = Math.abs(c - center);
      let include = true;
      if (patternMode === 0 && r > 1 && dist < 0.8) include = false;
      if (patternMode === 1 && r === condition.rows - 1 && c % 2 === 1) include = false;
      if (patternMode === 2 && r >= 2 && r <= condition.rows - 2 && Math.abs(dist - 1.5) < 0.4) {
        include = false;
      }
      if (patternMode === 3 && r >= 3 && dist > cols / 2 - 0.8) include = false;
      if (!include) continue;

      const isStone =
        r > 0 &&
        r < condition.rows - 1 &&
        rand() < condition.stoneRate;

      const colorIdx = Math.floor(
        ((r * 2 + Math.floor(dist) + Math.floor(rand() * 2)) % colors.length)
      );
      initialCells.push({
        row: r,
        col: c,
        kind: isStone ? 'stone' : 'color',
        color: isStone ? null : colors[colorIdx],
      });
      present.add(`${r},${c}`);
    }
  }

  // Ensure row 0 is well anchored and no disconnected islands exist at start
  for (let c = 0; c < getColsForRow(0); c++) {
    if (!present.has(`0,${c}`)) {
      initialCells.push({
        row: 0,
        col: c,
        kind: 'color',
        color: colors[c % colors.length],
      });
      present.add(`0,${c}`);
    }
  }

  const byKey = new Map(initialCells.map((cell) => [`${cell.row},${cell.col}`, cell]));
  for (let r = 1; r < condition.rows; r++) {
    const cols = getColsForRow(r);
    for (let c = 0; c < cols; c++) {
      if (!byKey.has(`${r},${c}`)) continue;
      const pL = r % 2 === 0 ? c - 1 : c;
      const pR = r % 2 === 0 ? c : c + 1;
      const hasParent =
        (pL >= 0 && byKey.has(`${r - 1},${pL}`)) ||
        (pR < getColsForRow(r - 1) && byKey.has(`${r - 1},${pR}`));
      if (!hasParent) {
        const bridgeCol = Math.max(0, Math.min(getColsForRow(r - 1) - 1, pR));
        const bridgeCell = {
          row: r - 1,
          col: bridgeCol,
          kind: 'color' as CellKind,
          color: colors[(r + bridgeCol) % colors.length],
        };
        byKey.set(`${r - 1},${bridgeCol}`, bridgeCell);
        initialCells.push(bridgeCell);
      }
    }
  }

  const colorCountOnBoard = initialCells.filter((c) => c.kind === 'color').length;
  const baseScore = colorCountOnBoard * 100;

  return {
    levelNumber: 0,
    tier: 'Expert',
    tierIndex: 8,
    title: 'Daily Challenge',
    patternName: condition.label,
    colors,
    maxMoves: condition.moves,
    colsEven: 9,
    rows: condition.rows,
    targetScores: [
      Math.round(baseScore * 0.8),
      Math.round(baseScore * 1.35),
      Math.round(baseScore * 1.9),
    ],
    initialCells,
    skyTheme,
    isDailyChallenge: true,
    dailyDateKey: dateKey,
    specialCondition: {
      kind: condition.kind,
      label: condition.label,
      description: condition.description,
    },
    rewardCoins: condition.rewardCoins,
    bonusPointsMultiplier: condition.multiplier,
  };
}
