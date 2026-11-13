import { getColsForRow } from './hexGrid';
import {
  ALL_BUBBLE_COLOR_IDS,
  BubbleColor,
  CellKind,
  DifficultyTier,
  LevelConfig,
} from './types';

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

interface TierProfile {
  tier: DifficultyTier;
  colorCountMin: number;
  colorCountMax: number;
  rowsMin: number;
  rowsMax: number;
  movesBase: number;
  stoneChance: number;
  skyTheme: { top: string; mid: string; bottom: string; accentHex: number };
}

const TIER_PROFILES: TierProfile[] = [
  {
    tier: 'Tutorial',
    colorCountMin: 3,
    colorCountMax: 3,
    rowsMin: 4,
    rowsMax: 5,
    movesBase: 28,
    stoneChance: 0,
    skyTheme: { top: '#0c1b47', mid: '#17377a', bottom: '#2366a8', accentHex: 0x38bdf8 },
  },
  {
    tier: 'Easy',
    colorCountMin: 3,
    colorCountMax: 4,
    rowsMin: 5,
    rowsMax: 6,
    movesBase: 27,
    stoneChance: 0,
    skyTheme: { top: '#11224d', mid: '#1c4f7a', bottom: '#24829c', accentHex: 0x2dd4bf },
  },
  {
    tier: 'Beginner-Intermediate',
    colorCountMin: 4,
    colorCountMax: 5,
    rowsMin: 5,
    rowsMax: 7,
    movesBase: 26,
    stoneChance: 0.03,
    skyTheme: { top: '#181c4a', mid: '#32307a', bottom: '#4d4aa8', accentHex: 0x818cf8 },
  },
  {
    tier: 'Medium',
    colorCountMin: 5,
    colorCountMax: 5,
    rowsMin: 6,
    rowsMax: 7,
    movesBase: 25,
    stoneChance: 0.05,
    skyTheme: { top: '#241447', mid: '#482278', bottom: '#71389c', accentHex: 0xc084fc },
  },
  {
    tier: 'Challenging',
    colorCountMin: 5,
    colorCountMax: 6,
    rowsMin: 6,
    rowsMax: 8,
    movesBase: 25,
    stoneChance: 0.07,
    skyTheme: { top: '#2e103b', mid: '#5c1c63', bottom: '#8c2d73', accentHex: 0xf472b6 },
  },
  {
    tier: 'Hard',
    colorCountMin: 6,
    colorCountMax: 6,
    rowsMin: 7,
    rowsMax: 8,
    movesBase: 24,
    stoneChance: 0.09,
    skyTheme: { top: '#2e1324', mid: '#63223e', bottom: '#963a4f', accentHex: 0xfb7185 },
  },
  {
    tier: 'Very Hard',
    colorCountMin: 6,
    colorCountMax: 7,
    rowsMin: 7,
    rowsMax: 9,
    movesBase: 24,
    stoneChance: 0.11,
    skyTheme: { top: '#26150f', mid: '#592d19', bottom: '#8c4a27', accentHex: 0xfb923c },
  },
  {
    tier: 'Expert',
    colorCountMin: 7,
    colorCountMax: 7,
    rowsMin: 8,
    rowsMax: 9,
    movesBase: 23,
    stoneChance: 0.12,
    skyTheme: { top: '#111d2b', mid: '#1f3a52', bottom: '#2b5f78', accentHex: 0x22d3ee },
  },
  {
    tier: 'Extremely Difficult',
    colorCountMin: 7,
    colorCountMax: 8,
    rowsMin: 8,
    rowsMax: 10,
    movesBase: 23,
    stoneChance: 0.14,
    skyTheme: { top: '#170f2e', mid: '#321c5e', bottom: '#582985', accentHex: 0xa78bfa },
  },
  {
    tier: 'Ultimate Challenge',
    colorCountMin: 8,
    colorCountMax: 8,
    rowsMin: 9,
    rowsMax: 10,
    movesBase: 22,
    stoneChance: 0.16,
    skyTheme: { top: '#090b1a', mid: '#1a163d', bottom: '#3c1e54', accentHex: 0xfbbf24 },
  },
];

const PATTERN_TEMPLATES = [
  'Prism Columns',
  'Chevron Cascade',
  'Crystal Arch',
  'Twin Bastions',
  'Diamond Matrix',
  'Orbital Rings',
  'Honeycomb Fortress',
  'Spiral Core',
  'Staggered Gate',
  'Crown Citadel',
];

function selectColorsForLevel(levelNumber: number, count: number, rand: () => number): BubbleColor[] {
  const pool = [...ALL_BUBBLE_COLOR_IDS];
  // Rotate starting offset by levelNumber for variety, then deterministic shuffle
  const rotated: BubbleColor[] = [];
  const offset = (levelNumber - 1) % pool.length;
  for (let i = 0; i < pool.length; i++) {
    rotated.push(pool[(i + offset) % pool.length]);
  }
  for (let i = rotated.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [rotated[i], rotated[j]] = [rotated[j], rotated[i]];
  }
  return rotated.slice(0, count);
}

function generateLevelPattern(
  levelNumber: number,
  tierIdx: number,
  rows: number,
  colors: BubbleColor[],
  stoneChance: number,
  rand: () => number
): Array<{ row: number; col: number; kind: CellKind; color: BubbleColor | null }> {
  const patternIdx = (levelNumber - 1) % PATTERN_TEMPLATES.length;
  const cells: Array<{ row: number; col: number; kind: CellKind; color: BubbleColor | null }> = [];
  const numColors = colors.length;

  for (let r = 0; r < rows; r++) {
    const cols = getColsForRow(r);
    const center = (cols - 1) / 2;

    for (let c = 0; c < cols; c++) {
      const distFromCenter = Math.abs(c - center);
      let include = true;
      let isStone = false;
      let colorIdx = 0;

      switch (patternIdx) {
        case 0: // Prism Columns (grouped vertical bands - great for tutorial combos)
          colorIdx = Math.floor((c / cols) * numColors);
          if (r >= rows - 1 && (c === 0 || c === cols - 1)) include = false;
          break;

        case 1: // Chevron Cascade (V-shaped rows)
          include = r < rows - 2 || distFromCenter <= rows - r + 1.2;
          colorIdx = (Math.floor(distFromCenter) + Math.floor(r / 2)) % numColors;
          break;

        case 2: // Crystal Arch (open center pocket)
          if (r >= 2 && r <= rows - 2 && distFromCenter < 1.2 && tierIdx >= 1) {
            include = false;
          }
          colorIdx = (c + r * 2) % numColors;
          if (tierIdx >= 2 && r === Math.floor(rows / 2) && (c === 1 || c === cols - 2)) {
            isStone = rand() < stoneChance + 0.35;
          }
          break;

        case 3: // Twin Bastions (two clusters with central canyon)
          if (r >= 1 && distFromCenter < 0.75) {
            include = false;
          }
          colorIdx = (Math.floor(c / 2) + r) % numColors;
          break;

        case 4: // Diamond Matrix (diamond holes + clustered color pockets)
          if (r >= 2 && r <= rows - 2 && Math.abs(r - Math.floor(rows / 2)) + distFromCenter < 2.2) {
            include = rand() > 0.45;
          }
          colorIdx = (Math.floor((r + c) / 2)) % numColors;
          break;

        case 5: // Orbital Rings (concentric bands around top center)
          {
            const radial = Math.round(Math.hypot(distFromCenter, r * 0.85));
            colorIdx = radial % numColors;
            if (r === rows - 1 && c % 2 === 1) include = false;
          }
          break;

        case 6: // Honeycomb Fortress (stone pillars guarding color pockets)
          colorIdx = ((c % 3) + Math.floor(r / 2)) % numColors;
          if (tierIdx >= 2 && r > 0 && r < rows - 1 && r % 2 === 1 && (c === 2 || c === cols - 3)) {
            isStone = rand() < stoneChance + 0.4;
          }
          break;

        case 7: // Spiral Core
          colorIdx = (Math.floor(distFromCenter * 1.5) + r) % numColors;
          if (r > 1 && (c + r) % 5 === 0 && tierIdx >= 1) include = false;
          break;

        case 8: // Staggered Gate
          if (r % 2 === 1 && (c === 0 || c === cols - 1)) include = false;
          colorIdx = (c * 2 + Math.floor(r / 2)) % numColors;
          if (tierIdx >= 3 && r === rows - 2 && c % 3 === 1) {
            isStone = rand() < stoneChance + 0.3;
          }
          break;

        case 9: // Crown Citadel (dense crown + fortified tips)
        default:
          if (r === rows - 1 && c % 2 === 0) include = false;
          colorIdx = (Math.floor(distFromCenter) + r) % numColors;
          if (tierIdx >= 4 && r === rows - 2 && (c === 1 || c === cols - 2)) {
            isStone = true;
          }
          break;
      }

      if (!include) continue;

      // Ensure row 0 is well-anchored so there are no initial floating islands
      if (r === 0) {
        isStone = false;
      }

      // Apply controlled randomness scaled by tier so later levels are trickier
      if (!isStone && r > 0 && stoneChance > 0 && rand() < stoneChance * 0.45) {
        isStone = true;
      }

      // Add color clustering jitter in higher tiers while keeping playable match pockets
      if (!isStone && rand() < 0.22 + tierIdx * 0.04) {
        colorIdx = Math.floor(rand() * numColors);
      }

      cells.push({
        row: r,
        col: c,
        kind: isStone ? 'stone' : 'color',
        color: isStone ? null : colors[colorIdx % numColors],
      });
    }
  }

  // Guarantee row 0 has at least 6 color bubbles and every non-row-0 bubble is connected to row 0
  const present = new Set(cells.map((cell) => `${cell.row},${cell.col}`));
  for (let c = 0; c < getColsForRow(0); c++) {
    if (!present.has(`0,${c}`)) {
      cells.push({
        row: 0,
        col: c,
        kind: 'color',
        color: colors[c % numColors],
      });
      present.add(`0,${c}`);
    }
  }

  // Guarantee no isolated floating bubbles at level start by bridging row-by-row upward if needed
  const byRowCol = new Map(cells.map((cell) => [`${cell.row},${cell.col}`, cell]));
  for (let r = 1; r < rows; r++) {
    const cols = getColsForRow(r);
    for (let c = 0; c < cols; c++) {
      if (!byRowCol.has(`${r},${c}`)) continue;
      const parentLeft = r % 2 === 0 ? c - 1 : c;
      const parentRight = r % 2 === 0 ? c : c + 1;
      const hasParent =
        (parentLeft >= 0 && byRowCol.has(`${r - 1},${parentLeft}`)) ||
        (parentRight < getColsForRow(r - 1) && byRowCol.has(`${r - 1},${parentRight}`));
      if (!hasParent) {
        const bridgeCol = Math.max(0, Math.min(getColsForRow(r - 1) - 1, parentRight));
        const bridgeCell = {
          row: r - 1,
          col: bridgeCol,
          kind: 'color' as CellKind,
          color: colors[(r + bridgeCol) % numColors],
        };
        byRowCol.set(`${r - 1},${bridgeCol}`, bridgeCell);
        cells.push(bridgeCell);
      }
    }
  }

  return cells;
}

function buildLevel(levelNumber: number): LevelConfig {
  const tierIndex = Math.min(9, Math.floor((levelNumber - 1) / 10));
  const subIndex = (levelNumber - 1) % 10; // 0..9 within tier
  const profile = TIER_PROFILES[tierIndex];
  const rand = mulberry32(levelNumber * 2654435761 + 97);

  const colorCount =
    subIndex < 5 ? profile.colorCountMin : profile.colorCountMax;
  const colors = selectColorsForLevel(levelNumber, colorCount, rand);
  const rows =
    subIndex < 5 ? profile.rowsMin : profile.rowsMax;

  // Tighter moves as levels climb within and across tiers
  const maxMoves = Math.max(
    18,
    profile.movesBase - Math.floor(subIndex / 3) + (tierIndex === 0 ? 4 : 0)
  );

  const initialCells = generateLevelPattern(
    levelNumber,
    tierIndex,
    rows,
    colors,
    profile.stoneChance,
    rand
  );

  const colorBubbleCount = initialCells.filter((c) => c.kind === 'color').length;
  const baseClearScore = colorBubbleCount * 100;
  const star1 = Math.round(baseClearScore * 0.75);
  const star2 = Math.round(baseClearScore * 1.25);
  const star3 = Math.round(baseClearScore * 1.75);

  const patternName = PATTERN_TEMPLATES[(levelNumber - 1) % PATTERN_TEMPLATES.length];

  return {
    levelNumber,
    tier: profile.tier,
    tierIndex,
    title: `Level ${levelNumber}`,
    patternName,
    colors,
    maxMoves,
    colsEven: 9,
    rows,
    targetScores: [star1, star2, star3],
    initialCells,
    skyTheme: profile.skyTheme,
  };
}

export const ALL_LEVELS: LevelConfig[] = Array.from({ length: 100 }, (_, i) =>
  buildLevel(i + 1)
);

export function getLevelConfig(levelNumber: number): LevelConfig {
  const clamped = Math.max(1, Math.min(100, Math.round(levelNumber)));
  return ALL_LEVELS[clamped - 1];
}
