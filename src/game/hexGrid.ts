import { BubbleColor, GridBubble } from './types';

export const BUBBLE_RADIUS = 0.48;
export const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
export const ROW_HEIGHT = BUBBLE_RADIUS * Math.sqrt(3); // ~0.8314
export const GRID_COLS_EVEN = 9;
export const GRID_COLS_ODD = 8;
export const MAX_GRID_ROWS = 14;
export const DANGER_ROW = 12;

// Playfield horizontal bounds centered at X = 0
// Even row has 9 bubbles: centers at -4*D .. +4*D => outer edges at ±(4.5 * D)
export const BOARD_HALF_WIDTH = (GRID_COLS_EVEN * BUBBLE_DIAMETER) / 2;
export const BOARD_TOP_Y = 5.4;
export const CANNON_Y = -5.65;

export function getColsForRow(row: number): number {
  return row % 2 === 0 ? GRID_COLS_EVEN : GRID_COLS_ODD;
}

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function gridToWorld(row: number, col: number): { x: number; y: number } {
  const isOdd = row % 2 === 1;
  const xOffset = isOdd ? BUBBLE_RADIUS : 0;
  const leftCenter = -((GRID_COLS_EVEN - 1) * BUBBLE_DIAMETER) / 2;
  const x = leftCenter + col * BUBBLE_DIAMETER + xOffset;
  const y = BOARD_TOP_Y - row * ROW_HEIGHT;
  return { x, y };
}

export function isValidCell(row: number, col: number): boolean {
  if (row < 0 || row >= MAX_GRID_ROWS) return false;
  const maxCols = getColsForRow(row);
  return col >= 0 && col < maxCols;
}

// Odd-r offset hex grid neighbors
const EVEN_ROW_OFFSETS: ReadonlyArray<[number, number]> = [
  [-1, -1],
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
];

const ODD_ROW_OFFSETS: ReadonlyArray<[number, number]> = [
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, 0],
  [1, 1],
];

export function getNeighbors(row: number, col: number): Array<{ row: number; col: number }> {
  const offsets = row % 2 === 0 ? EVEN_ROW_OFFSETS : ODD_ROW_OFFSETS;
  const result: Array<{ row: number; col: number }> = [];
  for (const [dr, dc] of offsets) {
    const nr = row + dr;
    const nc = col + dc;
    if (isValidCell(nr, nc)) {
      result.push({ row: nr, col: nc });
    }
  }
  return result;
}

export function findNearestEmptyCell(
  worldX: number,
  worldY: number,
  occupied: Map<string, GridBubble>
): { row: number; col: number } | null {
  const approxRow = Math.round((BOARD_TOP_Y - worldY) / ROW_HEIGHT);
  let bestCell: { row: number; col: number } | null = null;
  let bestDistSq = Infinity;

  const minRow = Math.max(0, approxRow - 2);
  const maxRow = Math.min(MAX_GRID_ROWS - 1, approxRow + 2);

  for (let r = minRow; r <= maxRow; r++) {
    const cols = getColsForRow(r);
    for (let c = 0; c < cols; c++) {
      const k = cellKey(r, c);
      if (occupied.has(k)) continue;
      const pos = gridToWorld(r, c);
      const dx = pos.x - worldX;
      const dy = pos.y - worldY;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestCell = { row: r, col: c };
      }
    }
  }

  return bestCell;
}

/**
 * Find connected cluster of same color bubbles starting from (startRow, startCol).
 */
export function findColorCluster(
  startRow: number,
  startCol: number,
  targetColor: BubbleColor,
  grid: Map<string, GridBubble>
): GridBubble[] {
  const startKey = cellKey(startRow, startCol);
  const startBubble = grid.get(startKey);
  if (!startBubble || startBubble.kind !== 'color' || startBubble.color !== targetColor) {
    return [];
  }

  const visited = new Set<string>([startKey]);
  const queue: GridBubble[] = [startBubble];
  const cluster: GridBubble[] = [];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    cluster.push(curr);
    for (const n of getNeighbors(curr.row, curr.col)) {
      const nk = cellKey(n.row, n.col);
      if (visited.has(nk)) continue;
      const nb = grid.get(nk);
      if (nb && nb.kind === 'color' && nb.color === targetColor) {
        visited.add(nk);
        queue.push(nb);
      }
    }
  }

  return cluster;
}

/**
 * Rainbow bubble connects to all neighboring color groups and pops any group of size >= 2
 * adjacent to the rainbow (plus the rainbow itself), or if isolated, pops adjacent singletons if >= 3 total.
 */
export function findRainbowMatches(
  rainbowRow: number,
  rainbowCol: number,
  grid: Map<string, GridBubble>
): GridBubble[] {
  const rainbowBubble = grid.get(cellKey(rainbowRow, rainbowCol));
  const matched = new Map<string, GridBubble>();
  const neighborColors = new Set<BubbleColor>();

  for (const n of getNeighbors(rainbowRow, rainbowCol)) {
    const nb = grid.get(cellKey(n.row, n.col));
    if (nb && nb.kind === 'color' && nb.color) {
      neighborColors.add(nb.color);
    }
  }

  for (const color of neighborColors) {
    // Check each neighbor of this color and gather its cluster
    for (const n of getNeighbors(rainbowRow, rainbowCol)) {
      const nk = cellKey(n.row, n.col);
      const nb = grid.get(nk);
      if (nb && nb.kind === 'color' && nb.color === color && !matched.has(nk)) {
        const cluster = findColorCluster(n.row, n.col, color, grid);
        if (cluster.length >= 2) {
          for (const b of cluster) {
            matched.set(cellKey(b.row, b.col), b);
          }
        }
      }
    }
  }

  if (matched.size > 0 && rainbowBubble) {
    matched.set(cellKey(rainbowRow, rainbowCol), rainbowBubble);
    return Array.from(matched.values());
  }

  // Fallback: if rainbow touches at least 2 colored bubbles (even mixed colors), clear rainbow + adjacent colors
  const directColors: GridBubble[] = [];
  for (const n of getNeighbors(rainbowRow, rainbowCol)) {
    const nb = grid.get(cellKey(n.row, n.col));
    if (nb && nb.kind === 'color') directColors.push(nb);
  }
  if (directColors.length >= 2 && rainbowBubble) {
    return [rainbowBubble, ...directColors];
  }

  return [];
}

/**
 * Find all bubbles that are no longer anchored to row 0 (ceiling) directly or via neighbors.
 */
export function findFloatingBubbles(grid: Map<string, GridBubble>): GridBubble[] {
  const anchored = new Set<string>();
  const queue: GridBubble[] = [];

  for (const bubble of grid.values()) {
    if (bubble.row === 0) {
      const k = cellKey(bubble.row, bubble.col);
      anchored.add(k);
      queue.push(bubble);
    }
  }

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const n of getNeighbors(curr.row, curr.col)) {
      const nk = cellKey(n.row, n.col);
      if (anchored.has(nk)) continue;
      if (grid.has(nk)) {
        anchored.add(nk);
        queue.push(grid.get(nk)!);
      }
    }
  }

  const floating: GridBubble[] = [];
  for (const [k, bubble] of grid.entries()) {
    if (!anchored.has(k)) {
      floating.push(bubble);
    }
  }
  return floating;
}

export interface AimPoint {
  x: number;
  y: number;
}

export interface AimTraceResult {
  points: AimPoint[];
  hitBubble: GridBubble | null;
  hitCeiling: boolean;
  snapCell: { row: number; col: number } | null;
}

/**
 * Trace projectile trajectory from cannon with side-wall reflections until hitting ceiling or a grid bubble.
 */
export function traceAimTrajectory(
  angleRad: number, // angle relative to +Y (0 = straight up, positive = right, negative = left)
  grid: Map<string, GridBubble>,
  maxSteps = 220,
  stepSize = 0.14
): AimTraceResult {
  const wallMinX = -BOARD_HALF_WIDTH + BUBBLE_RADIUS;
  const wallMaxX = BOARD_HALF_WIDTH - BUBBLE_RADIUS;
  const ceilingY = BOARD_TOP_Y;
  const collisionDist = BUBBLE_DIAMETER * 0.88;
  const collisionDistSq = collisionDist * collisionDist;

  let x = 0;
  let y = CANNON_Y + 0.65;
  let vx = Math.sin(angleRad);
  let vy = Math.cos(angleRad);

  const points: AimPoint[] = [{ x, y }];
  let hitBubble: GridBubble | null = null;
  let hitCeiling = false;

  for (let i = 0; i < maxSteps; i++) {
    const nextX = x + vx * stepSize;
    const nextY = y + vy * stepSize;

    x = nextX;
    y = nextY;

    if (x <= wallMinX) {
      x = wallMinX + (wallMinX - x);
      vx = Math.abs(vx);
      points.push({ x: wallMinX, y });
    } else if (x >= wallMaxX) {
      x = wallMaxX - (x - wallMaxX);
      vx = -Math.abs(vx);
      points.push({ x: wallMaxX, y });
    }

    if (i % 3 === 0) {
      points.push({ x, y });
    }

    // Check bubble collisions
    for (const b of grid.values()) {
      const bp = gridToWorld(b.row, b.col);
      const dx = x - bp.x;
      const dy = y - bp.y;
      if (dx * dx + dy * dy <= collisionDistSq) {
        hitBubble = b;
        points.push({ x, y });
        const snapCell = findNearestEmptyCell(x, y, grid);
        return { points, hitBubble, hitCeiling: false, snapCell };
      }
    }

    if (y >= ceilingY) {
      hitCeiling = true;
      points.push({ x, y: ceilingY });
      const snapCell = findNearestEmptyCell(x, ceilingY, grid);
      return { points, hitBubble: null, hitCeiling, snapCell };
    }
  }

  return { points, hitBubble, hitCeiling, snapCell: null };
}
