import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cellKey,
  findColorCluster,
  findFloatingBubbles,
  getNeighbors,
  traceAimTrajectory,
} from './hexGrid';
import { ALL_LEVELS, getLevelConfig } from './levels';
import {
  buildGridFromLevel,
  buyPowerUpWithCoins,
  calculatePopScore,
  calculateStarRating,
  createDefaultProgress,
  recordDailyChallengeVictory,
  recordLevelVictory,
  resolveShotOnGrid,
} from './rules';
import { getDailyChallenge } from './dailyChallenge';
import { GridBubble } from './types';

test('all 100 levels exist with progressive difficulty tiers and valid geometry', () => {
  assert.equal(ALL_LEVELS.length, 100);
  const seenSignatures = new Set<string>();

  for (let i = 1; i <= 100; i++) {
    const level = getLevelConfig(i);
    assert.equal(level.levelNumber, i);
    assert.ok(level.colors.length >= 3 && level.colors.length <= 8);
    assert.ok(level.maxMoves >= 18);
    assert.ok(level.initialCells.length >= 20, `Level ${i} too empty`);

    // Ensure no initial floating islands
    const grid = buildGridFromLevel(level);
    const floating = findFloatingBubbles(grid);
    assert.equal(floating.length, 0, `Level ${i} has initial floating bubbles`);

    // Check uniqueness across patterns/colors/cells
    const sig = `${level.colors.join(',')}|${level.initialCells
      .map((c) => `${c.row}:${c.col}:${c.color ?? 'S'}`)
      .join(';')}`;
    seenSignatures.add(sig);
  }

  assert.equal(seenSignatures.size, 100, 'All 100 levels should have distinct layouts');
  assert.equal(getLevelConfig(1).colors.length, 3);
  assert.equal(getLevelConfig(1).tier, 'Tutorial');
  assert.equal(getLevelConfig(100).colors.length, 8);
  assert.equal(getLevelConfig(100).tier, 'Ultimate Challenge');
});

test('hex grid neighbors and 3+ color cluster matching work accurately', () => {
  const neighborsEven = getNeighbors(0, 4);
  assert.equal(neighborsEven.length, 4); // row 0 has no row -1

  const neighborsMid = getNeighbors(2, 4);
  assert.equal(neighborsMid.length, 6);

  const grid = new Map<string, GridBubble>();
  grid.set(cellKey(0, 2), { id: 1, row: 0, col: 2, kind: 'color', color: 'red' });
  grid.set(cellKey(0, 3), { id: 2, row: 0, col: 3, kind: 'color', color: 'red' });
  grid.set(cellKey(0, 4), { id: 4, row: 0, col: 4, kind: 'color', color: 'blue' });
  grid.set(cellKey(1, 3), { id: 3, row: 1, col: 3, kind: 'color', color: 'blue' });

  // Shooting a red bubble at (1, 1) touches (0, 2) -> cluster size 3!
  const res = resolveShotOnGrid(grid, { kind: 'color', color: 'red' }, 1, 1, 99, 0);
  assert.equal(res.popped.length, 3);
  assert.equal(res.dropped.length, 0);
  assert.ok(res.pointsEarned > 0);
});

test('floating disconnected bubbles drop when anchor is popped', () => {
  const grid = new Map<string, GridBubble>();
  grid.set(cellKey(0, 2), { id: 1, row: 0, col: 2, kind: 'color', color: 'green' });
  grid.set(cellKey(0, 3), { id: 2, row: 0, col: 3, kind: 'color', color: 'green' });
  // (1, 2) hangs exclusively off (0,2) and (0,3)
  grid.set(cellKey(1, 2), { id: 3, row: 1, col: 2, kind: 'color', color: 'yellow' });
  // (2, 2) hangs off (1, 2)
  grid.set(cellKey(2, 2), { id: 4, row: 2, col: 2, kind: 'color', color: 'purple' });

  // Pop the green anchor by placing a green bubble at (0, 1)
  const res = resolveShotOnGrid(grid, { kind: 'color', color: 'green' }, 0, 1, 50, 0);
  assert.equal(res.popped.length, 3);
  assert.equal(res.dropped.length, 2);
  assert.equal(res.boardCleared, true);
});

test('power-ups: bomb, rainbow, fire, lightning resolve properly', () => {
  const grid = new Map<string, GridBubble>();
  for (let c = 0; c < 6; c++) {
    grid.set(cellKey(0, c), { id: c + 1, row: 0, col: c, kind: 'color', color: 'cyan' });
    grid.set(cellKey(1, c), {
      id: 20 + c,
      row: 1,
      col: c,
      kind: c === 2 ? 'stone' : 'color',
      color: c === 2 ? null : 'orange',
    });
  }

  // Fire destroys row 1 completely
  const fireGrid = new Map(grid);
  const fireRes = resolveShotOnGrid(fireGrid, { kind: 'fire' }, 1, 2, 100, 0);
  assert.ok(fireRes.popped.length >= 6);

  // Bomb clears radius 2 around (1,2), destroying stone too
  const bombGrid = new Map(grid);
  const bombRes = resolveShotOnGrid(bombGrid, { kind: 'bomb' }, 1, 2, 100, 0);
  assert.ok(bombRes.popped.some((b) => b.kind === 'stone'));

  // Rainbow clears adjacent matching cluster of >= 2
  const rainbowGrid = new Map<string, GridBubble>();
  rainbowGrid.set(cellKey(0, 0), { id: 1, row: 0, col: 0, kind: 'color', color: 'pink' });
  rainbowGrid.set(cellKey(0, 1), { id: 2, row: 0, col: 1, kind: 'color', color: 'pink' });
  const rRes = resolveShotOnGrid(rainbowGrid, { kind: 'rainbow' }, 1, 0, 100, 0);
  assert.equal(rRes.popped.length, 3);
  assert.equal(rRes.boardCleared, true);

  // Lightning clears neighbors + matching color chain
  const lightGrid = new Map(grid);
  const lRes = resolveShotOnGrid(lightGrid, { kind: 'lightning' }, 1, 1, 100, 0);
  assert.ok(lRes.popped.length >= 4);
});

test('aim trajectory bounces off side walls and snaps to valid cell', () => {
  const level = getLevelConfig(1);
  const grid = buildGridFromLevel(level);
  const trace = traceAimTrajectory(0.65, grid);
  assert.ok(trace.points.length >= 4);
  assert.ok(trace.hitBubble !== null || trace.hitCeiling);
  assert.ok(trace.snapCell !== null);
});

test('scoring, stars, and progress unlock recording', () => {
  const score = calculatePopScore(3, 2, 1);
  assert.equal(score, Math.round((300 + 360) * 1.25));

  assert.equal(calculateStarRating(1000, [500, 900, 1500]), 2);
  assert.equal(calculateStarRating(1600, [500, 900, 1500]), 3);

  const p0 = createDefaultProgress();
  const p1 = recordLevelVictory(p0, 1, 1800, 3);
  assert.equal(p1.unlockedLevel, 2);
  assert.equal(p1.levelStats[1].stars, 3);
  assert.equal(p1.levelStats[1].bestScore, 1800);
  assert.ok(p1.coins > p0.coins);
});

test('daily challenge generates unique valid levels per date and awards coins + streak', () => {
  const day1 = getDailyChallenge('2026-11-13');
  const day2 = getDailyChallenge('2026-11-14');

  assert.equal(day1.isDailyChallenge, true);
  assert.equal(day1.dailyDateKey, '2026-11-13');
  assert.ok(day1.specialCondition);
  assert.ok((day1.rewardCoins ?? 0) >= 100);
  assert.equal(findFloatingBubbles(buildGridFromLevel(day1)).length, 0);
  assert.equal(findFloatingBubbles(buildGridFromLevel(day2)).length, 0);
  assert.notEqual(
    JSON.stringify(day1.initialCells),
    JSON.stringify(day2.initialCells)
  );

  const p0 = createDefaultProgress();
  const r1 = recordDailyChallengeVictory(p0, '2026-11-13', 4200, 160);
  assert.equal(r1.isFirstToday, true);
  assert.equal(r1.coinsAwarded, 160);
  assert.equal(r1.progress.dailyChallenge.streak, 1);

  const r2 = recordDailyChallengeVictory(r1.progress, '2026-11-14', 5100, 160);
  assert.equal(r2.isFirstToday, true);
  assert.equal(r2.progress.dailyChallenge.streak, 2);
  assert.ok(r2.coinsAwarded > 160); // includes streak bonus

  const bought = buyPowerUpWithCoins(r2.progress, 'bomb');
  assert.ok(bought !== null);
  assert.equal(bought!.powerUps.bomb, r2.progress.powerUps.bomb + 1);
  assert.ok(bought!.coins < r2.progress.coins);
});
