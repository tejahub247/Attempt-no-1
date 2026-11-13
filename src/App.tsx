import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import {
  BubbleScene3D,
  BubbleSceneHandle,
  ShotResultEvent,
} from './components/BubbleScene3D';
import { GameHUD } from './components/GameHUD';
import { HomeScreen } from './components/HomeScreen';
import { LevelSelectScreen } from './components/LevelSelectScreen';
import {
  GameOverModal,
  PauseModal,
  SettingsModal,
  VictoryModal,
} from './components/Modals';
import { SplashScreen } from './components/SplashScreen';
import { getDailyChallenge, getLocalDateKey } from './game/dailyChallenge';
import { getLevelConfig } from './game/levels';
import {
  buildGridFromLevel,
  buyPowerUpWithCoins,
  calculateRemainingMovesBonus,
  calculateStarRating,
  createDefaultProgress,
  loadProgress,
  pickNextBubbleColor,
  recordDailyChallengeVictory,
  recordLevelVictory,
  resolveShotOnGrid,
  saveProgress,
} from './game/rules';
import {
  ActiveShotKind,
  BubbleColor,
  GridBubble,
  LevelConfig,
  PlayerProgress,
  PowerUpType,
  ScreenMode,
} from './game/types';
import { useOnlineStatus } from './hooks/usePWAInstall';

export default function App() {
  const isAutostart = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  }, []);

  const [progress, setProgress] = useState<PlayerProgress>(() => loadProgress());
  const [mode, setMode] = useState<ScreenMode>(() =>
    isAutostart ? 'playing' : 'splash'
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  const todayKey = useMemo(() => getLocalDateKey(), []);
  const dailyChallenge = useMemo(() => getDailyChallenge(todayKey), [todayKey]);

  const [activeLevel, setActiveLevel] = useState<LevelConfig>(() =>
    getLevelConfig(loadProgress().currentLevel)
  );
  const gridRef = useRef<Map<string, GridBubble>>(buildGridFromLevel(activeLevel));
  const [gridVersion, setGridVersion] = useState(0);
  const nextIdRef = useRef(500);

  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(activeLevel.maxMoves);
  const [comboStreak, setComboStreak] = useState(0);
  const [activeShot, setActiveShot] = useState<ActiveShotKind>(() => ({
    kind: 'color',
    color: pickNextBubbleColor(gridRef.current, activeLevel.colors),
  }));
  const [nextColor, setNextColor] = useState<BubbleColor>(() =>
    pickNextBubbleColor(gridRef.current, activeLevel.colors)
  );
  const [shotInFlight, setShotInFlight] = useState(false);

  // End-of-round frozen summary snapshot
  const [victoryStats, setVictoryStats] = useState({
    finalScore: 0,
    movesBonus: 0,
    starsEarned: 3,
    coinsEarned: 0,
    streak: 0,
  });
  const [defeatReason, setDefeatReason] = useState<'moves' | 'overflow'>('moves');

  const sceneHandleRef = useRef<BubbleSceneHandle | null>(null);
  const isOnline = useOnlineStatus();

  // Sync audio preferences
  useEffect(() => {
    soundEngine.setSoundEnabled(progress.soundEnabled);
    soundEngine.setMusicEnabled(progress.musicEnabled);
  }, [progress.soundEnabled, progress.musicEnabled]);

  // Persist progress whenever it changes
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // Mirror game state machine to document.body.dataset.state
  useEffect(() => {
    const mapped =
      mode === 'splash' || mode === 'home' || mode === 'levels'
        ? 'title'
        : mode === 'playing'
        ? 'playing'
        : mode === 'paused'
        ? 'paused'
        : 'gameover';
    document.body.dataset.state = mapped;

    if (mode === 'paused') {
      soundEngine.pauseMusic();
    } else if (mode === 'playing') {
      soundEngine.resumeMusic();
    }
  }, [mode]);

  const startLevelConfig = useCallback((lvl: LevelConfig) => {
    soundEngine.unlock();
    const freshGrid = buildGridFromLevel(lvl);
    gridRef.current = freshGrid;
    nextIdRef.current = 500;

    const firstColor = pickNextBubbleColor(freshGrid, lvl.colors);
    const secondColor = pickNextBubbleColor(freshGrid, lvl.colors);

    setActiveLevel(lvl);
    setScore(0);
    setMovesLeft(lvl.maxMoves);
    setComboStreak(0);
    setActiveShot({ kind: 'color', color: firstColor });
    setNextColor(secondColor);
    setShotInFlight(false);
    setGridVersion((v) => v + 1);
    setMode('playing');

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  const handlePlayCurrent = useCallback(() => {
    const lvl = getLevelConfig(progress.currentLevel);
    startLevelConfig(lvl);
  }, [progress.currentLevel, startLevelConfig]);

  const handleSelectLevel = useCallback(
    (levelNumber: number) => {
      if (levelNumber > progress.unlockedLevel) return;
      setProgress((prev) => ({ ...prev, currentLevel: levelNumber }));
      startLevelConfig(getLevelConfig(levelNumber));
    },
    [progress.unlockedLevel, startLevelConfig]
  );

  const handlePlayDaily = useCallback(() => {
    startLevelConfig(dailyChallenge);
  }, [dailyChallenge, startLevelConfig]);

  // Keyboard shortcuts (Escape / P to pause, Enter/Space on home to start)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (settingsOpen) {
        if (e.key === 'Escape') setSettingsOpen(false);
        return;
      }
      if (mode === 'home' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        handlePlayCurrent();
      } else if (mode === 'playing' && (e.key === 'Escape' || e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setMode('paused');
      } else if (mode === 'paused' && (e.key === 'Escape' || e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setMode('playing');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, settingsOpen, handlePlayCurrent]);

  const handleShootFired = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playShoot();
    setShotInFlight(true);
  }, []);

  const handleWallBounce = useCallback(() => {
    soundEngine.playBounce();
  }, []);

  const handleShotLanded = useCallback(
    (event: ShotResultEvent) => {
      const grid = gridRef.current;
      const resolution = resolveShotOnGrid(
        grid,
        event.shot,
        event.landRow,
        event.landCol,
        nextIdRef.current++,
        comboStreak
      );

      const isPowerShot =
        event.shot.kind === 'bomb' ||
        event.shot.kind === 'fire' ||
        event.shot.kind === 'lightning';

      if (event.shot.kind === 'bomb' || event.shot.kind === 'fire') {
        soundEngine.playExplosion();
      } else if (event.shot.kind === 'lightning') {
        soundEngine.playLightning();
      } else if (resolution.popped.length > 0) {
        soundEngine.playPop(comboStreak);
      }

      if (resolution.dropped.length > 0) {
        soundEngine.playDrop(resolution.dropped.length);
      }

      if (resolution.popped.length > 0) {
        sceneHandleRef.current?.spawnPopEffects(
          resolution.popped,
          isPowerShot || resolution.popped.length >= 5
        );
      }
      if (resolution.dropped.length > 0) {
        sceneHandleRef.current?.spawnFallingBubbles(resolution.dropped);
      }

      const multiplier = activeLevel.bonusPointsMultiplier ?? 1;
      const earned = Math.round(resolution.pointsEarned * multiplier);
      const nextScore = score + earned;
      const nextMoves = Math.max(0, movesLeft - 1);
      const nextCombo = resolution.popped.length > 0 ? comboStreak + 1 : 0;

      setScore(nextScore);
      setMovesLeft(nextMoves);
      setComboStreak(nextCombo);
      setGridVersion((v) => v + 1);
      setShotInFlight(false);

      if (resolution.boardCleared) {
        const movesBonus = calculateRemainingMovesBonus(nextMoves);
        const finalScore = nextScore + movesBonus;
        const starsEarned = calculateStarRating(finalScore, activeLevel.targetScores);
        soundEngine.playVictory();

        if (activeLevel.isDailyChallenge && activeLevel.dailyDateKey) {
          const dailyRes = recordDailyChallengeVictory(
            progress,
            activeLevel.dailyDateKey,
            finalScore,
            activeLevel.rewardCoins ?? 150
          );
          setProgress(dailyRes.progress);
          setVictoryStats({
            finalScore,
            movesBonus,
            starsEarned,
            coinsEarned: dailyRes.coinsAwarded,
            streak: dailyRes.progress.dailyChallenge.streak,
          });
        } else {
          const prevCoins = progress.coins;
          const updated = recordLevelVictory(
            progress,
            activeLevel.levelNumber,
            finalScore,
            starsEarned
          );
          setProgress(updated);
          setVictoryStats({
            finalScore,
            movesBonus,
            starsEarned,
            coinsEarned: updated.coins - prevCoins,
            streak: 0,
          });
        }

        setMode('victory');
        return;
      }

      if (resolution.gameOverByOverflow) {
        soundEngine.playGameOver();
        setDefeatReason('overflow');
        setMode('gameover');
        return;
      }

      if (nextMoves <= 0) {
        soundEngine.playGameOver();
        setDefeatReason('moves');
        setMode('gameover');
        return;
      }

      // Advance shot queue ensuring colors match remaining board colors
      const validNextColor = grid.size > 0
        ? pickNextBubbleColor(grid, activeLevel.colors)
        : nextColor;
      const availableSet = new Set<BubbleColor>();
      for (const b of grid.values()) {
        if (b.kind === 'color' && b.color) availableSet.add(b.color);
      }
      const loadedColor =
        availableSet.size === 0 || availableSet.has(nextColor)
          ? nextColor
          : pickNextBubbleColor(grid, activeLevel.colors);

      setActiveShot({ kind: 'color', color: loadedColor });
      setNextColor(validNextColor);
    },
    [activeLevel, comboStreak, movesLeft, nextColor, progress, score]
  );

  const handleSwapBubble = useCallback(() => {
    if (shotInFlight || activeShot.kind !== 'color') return;
    soundEngine.playPowerUpSelect();
    const current = activeShot.color;
    setActiveShot({ kind: 'color', color: nextColor });
    setNextColor(current);
  }, [activeShot, nextColor, shotInFlight]);

  const handleUsePowerUp = useCallback(
    (type: PowerUpType) => {
      if (shotInFlight) return;
      soundEngine.unlock();

      // If already armed with this power-up, disarm back to color shot and refund count?
      // Better: power-up count is consumed immediately on activation (except Extra Moves which adds +5 right away)
      const stock = progress.powerUps[type] ?? 0;

      if (stock <= 0) {
        const bought = buyPowerUpWithCoins(progress, type);
        if (!bought) return;
        // Immediately activate after buying with Gems!
        soundEngine.playPowerUpSelect();
        if (type === 'extraMoves') {
          setMovesLeft((m) => m + 5);
          setProgress({
            ...bought,
            powerUps: { ...bought.powerUps, extraMoves: bought.powerUps.extraMoves - 1 },
          });
        } else {
          setProgress({
            ...bought,
            powerUps: { ...bought.powerUps, [type]: bought.powerUps[type] - 1 },
          });
          setActiveShot({ kind: type });
        }
        return;
      }

      if (activeShot.kind === type) return; // already armed

      soundEngine.playPowerUpSelect();
      if (type === 'extraMoves') {
        setMovesLeft((m) => m + 5);
        setProgress((prev) => ({
          ...prev,
          powerUps: { ...prev.powerUps, extraMoves: Math.max(0, prev.powerUps.extraMoves - 1) },
        }));
      } else {
        setProgress((prev) => ({
          ...prev,
          powerUps: { ...prev.powerUps, [type]: Math.max(0, prev.powerUps[type] - 1) },
        }));
        setActiveShot({ kind: type });
      }
    },
    [activeShot.kind, progress, shotInFlight]
  );

  const toggleSound = useCallback(() => {
    soundEngine.unlock();
    setProgress((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  }, []);

  const toggleMusic = useCallback(() => {
    soundEngine.unlock();
    setProgress((prev) => ({ ...prev, musicEnabled: !prev.musicEnabled }));
  }, []);

  const toggleAimGuide = useCallback(() => {
    setProgress((prev) => ({ ...prev, aimGuideEnabled: !prev.aimGuideEnabled }));
  }, []);

  const resetAllProgress = useCallback(() => {
    const fresh = createDefaultProgress();
    setProgress(fresh);
    saveProgress(fresh);
  }, []);

  const isDailyCompletedToday =
    progress.dailyChallenge.completedDates.includes(todayKey);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans text-white">
      {/* Persistent 3D WebGL Viewport */}
      <BubbleScene3D
        mode={mode}
        level={activeLevel}
        grid={gridRef.current}
        gridVersion={gridVersion}
        activeShot={activeShot}
        nextColor={nextColor}
        aimGuideEnabled={progress.aimGuideEnabled}
        canShoot={mode === 'playing' && !shotInFlight && !settingsOpen}
        sceneRef={sceneHandleRef}
        onShootFired={handleShootFired}
        onWallBounce={handleWallBounce}
        onShotLanded={handleShotLanded}
      />

      {mode === 'splash' && (
        <SplashScreen onComplete={() => setMode('home')} />
      )}

      {mode === 'home' && (
        <HomeScreen
          progress={progress}
          dailyChallenge={dailyChallenge}
          isDailyCompletedToday={isDailyCompletedToday}
          onPlayCurrent={handlePlayCurrent}
          onPlayDaily={handlePlayDaily}
          onOpenLevels={() => setMode('levels')}
          onOpenSettings={() => setSettingsOpen(true)}
          onToggleSound={toggleSound}
          onToggleMusic={toggleMusic}
        />
      )}

      {mode === 'levels' && (
        <LevelSelectScreen
          progress={progress}
          onSelectLevel={handleSelectLevel}
          onBack={() => setMode('home')}
        />
      )}

      {(mode === 'playing' || mode === 'paused' || mode === 'victory' || mode === 'gameover') && (
        <GameHUD
          level={activeLevel}
          score={score}
          movesLeft={movesLeft}
          comboStreak={comboStreak}
          activeShot={activeShot}
          nextColor={nextColor}
          progress={progress}
          canShoot={mode === 'playing' && !shotInFlight}
          onPause={() => setMode('paused')}
          onSwapBubble={handleSwapBubble}
          onUsePowerUp={handleUsePowerUp}
        />
      )}

      {mode === 'paused' && (
        <PauseModal
          level={activeLevel}
          soundEnabled={progress.soundEnabled}
          musicEnabled={progress.musicEnabled}
          onResume={() => setMode('playing')}
          onRestart={() => startLevelConfig(activeLevel)}
          onHome={() => setMode('home')}
          onToggleSound={toggleSound}
          onToggleMusic={toggleMusic}
        />
      )}

      {mode === 'victory' && (
        <VictoryModal
          level={activeLevel}
          finalScore={victoryStats.finalScore}
          movesBonus={victoryStats.movesBonus}
          starsEarned={victoryStats.starsEarned}
          coinsEarned={victoryStats.coinsEarned}
          dailyStreak={victoryStats.streak}
          hasNextLevel={activeLevel.levelNumber < 100}
          onNextLevel={() => {
            const nextNum = Math.min(100, activeLevel.levelNumber + 1);
            setProgress((p) => ({ ...p, currentLevel: nextNum }));
            startLevelConfig(getLevelConfig(nextNum));
          }}
          onReplay={() => startLevelConfig(activeLevel)}
          onHome={() => setMode('home')}
        />
      )}

      {mode === 'gameover' && (
        <GameOverModal
          level={activeLevel}
          score={score}
          reason={defeatReason}
          onRetry={() => startLevelConfig(activeLevel)}
          onHome={() => setMode('home')}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          progress={progress}
          onClose={() => setSettingsOpen(false)}
          onToggleSound={toggleSound}
          onToggleMusic={toggleMusic}
          onToggleAimGuide={toggleAimGuide}
          onResetProgress={resetAllProgress}
        />
      )}

      {!isOnline && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-lg">
          Offline Mode · Local Progress Active
        </div>
      )}
    </div>
  );
}
