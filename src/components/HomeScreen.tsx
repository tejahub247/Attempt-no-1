import React, { useState } from 'react';
import {
  Calendar,
  Download,
  Grid3X3,
  Music,
  Play,
  Settings,
  Star,
  Volume2,
  VolumeX,
  Gem,
  CheckCircle2,
  Flame,
} from 'lucide-react';
import { LevelConfig, PlayerProgress } from '../game/types';
import { LOGO_IMAGE_PATH } from './SplashScreen';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface HomeScreenProps {
  progress: PlayerProgress;
  dailyChallenge: LevelConfig;
  isDailyCompletedToday: boolean;
  onPlayCurrent: () => void;
  onPlayDaily: () => void;
  onOpenLevels: () => void;
  onOpenSettings: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  progress,
  dailyChallenge,
  isDailyCompletedToday,
  onPlayCurrent,
  onPlayDaily,
  onOpenLevels,
  onOpenSettings,
  onToggleSound,
  onToggleMusic,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const totalStars = Object.values(progress.levelStats).reduce(
    (sum, r) => sum + (r.stars || 0),
    0
  );

  return (
    <main className="fixed inset-0 z-20 flex flex-col justify-between px-4 py-4 sm:px-8 sm:py-6 bg-slate-950/45 text-white overflow-y-auto">
      {/* Top Bar: Sound, Music, Coins & Settings */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm font-semibold text-amber-200 tabular-nums bg-slate-900/85 border border-white/15 rounded-2xl px-4 py-2.5">
          <span className="flex items-center gap-1.5">
            <Gem className="w-4 h-4 text-cyan-300" aria-hidden="true" />
            <span>{progress.coins}</span>
            <span className="text-xs text-slate-300 font-normal">Gems</span>
          </span>
          <span className="text-white/25" aria-hidden="true">·</span>
          <span className="flex items-center gap-1.5">
            <Star className="w-4 h-4 text-amber-300 fill-amber-300" aria-hidden="true" />
            <span>{totalStars}</span>
            <span className="text-xs text-slate-300 font-normal">/ 300</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={progress.soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            aria-pressed={progress.soundEnabled}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-900/85 border border-white/15 text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {progress.soundEnabled ? (
              <Volume2 className="w-5 h-5 text-cyan-300" />
            ) : (
              <VolumeX className="w-5 h-5 text-slate-400" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleMusic}
            aria-label={progress.musicEnabled ? 'Mute background music' : 'Enable background music'}
            aria-pressed={progress.musicEnabled}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-900/85 border border-white/15 text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Music
              className={`w-5 h-5 ${
                progress.musicEnabled ? 'text-fuchsia-300' : 'text-slate-400 line-through'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-900/85 border border-white/15 text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Center Hero: Official Logo + Primary Actions + Daily Challenge */}
      <section className="w-full max-w-4xl mx-auto my-auto py-4 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left/Top Column: Official Logo & Brand Title */}
        <div className="lg:col-span-6 flex flex-col items-center text-center">
          <div className="relative p-1.5 rounded-full bg-gradient-to-tr from-cyan-400 via-fuchsia-400 to-amber-300 shadow-[0_0_52px_rgba(56,189,248,0.4)]">
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden bg-slate-950 border-2 border-white/30">
              <img
                src={LOGO_IMAGE_PATH}
                alt="Prism Pop 3D Official Logo"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-[50%_45%]"
              />
            </div>
          </div>

          <h1 className="mt-5 font-display text-4xl sm:text-5xl font-bold tracking-tight text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.75)]">
            Prism Pop 3D
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-sky-100/85 max-w-sm">
            Match luminous 3D spheres, unleash elemental boosters, and conquer 100 handcrafted stages.
          </p>
        </div>

        {/* Right/Bottom Column: Primary CTA, Levels, Daily Challenge */}
        <div className="lg:col-span-6 flex flex-col gap-3.5 w-full max-w-md mx-auto">
          <button
            type="button"
            data-start="true"
            onClick={onPlayCurrent}
            className="w-full min-h-[56px] px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 text-slate-950 font-display text-xl font-bold tracking-tight flex items-center justify-center gap-3 shadow-[0_10px_28px_rgba(14,165,233,0.45)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Play className="w-6 h-6 fill-slate-950" aria-hidden="true" />
            <span>Play Level {progress.currentLevel}</span>
          </button>

          <button
            type="button"
            onClick={onOpenLevels}
            className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-slate-900/90 border border-white/15 text-white font-semibold text-base flex items-center justify-between hover:bg-slate-800/95 active:scale-[0.99] transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              <Grid3X3 className="w-5 h-5 text-sky-300" aria-hidden="true" />
              <span>Level Selection</span>
            </span>
            <span className="text-sm text-sky-200 tabular-nums">
              {progress.unlockedLevel} / 100 Unlocked
            </span>
          </button>

          {/* Daily Challenge Card */}
          <div className="rounded-2xl bg-slate-900/90 border border-amber-300/35 p-4 flex flex-col gap-3 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                  <span>Daily Challenge · {dailyChallenge.dailyDateKey}</span>
                </div>
                <h2 className="mt-1 font-display text-lg font-bold text-white">
                  {dailyChallenge.specialCondition?.label}
                </h2>
                <p className="mt-0.5 text-xs text-slate-300 leading-relaxed">
                  {dailyChallenge.specialCondition?.description}
                </p>
              </div>
              {progress.dailyChallenge.streak > 0 && (
                <div className="shrink-0 flex items-center gap-1 text-xs font-semibold text-orange-300 tabular-nums">
                  <Flame className="w-4 h-4" aria-hidden="true" />
                  <span>{progress.dailyChallenge.streak}d</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onPlayDaily}
              className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isDailyCompletedToday
                  ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30'
                  : 'bg-amber-400 text-slate-950 hover:bg-amber-300 active:scale-[0.98]'
              }`}
            >
              {isDailyCompletedToday ? (
                <>
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>Completed Today · Replay for +25 Gems</span>
                </>
              ) : (
                <>
                  <Gem className="w-4 h-4" aria-hidden="true" />
                  <span>Play Daily Challenge (+{dailyChallenge.rewardCoins} Gems)</span>
                </>
              )}
            </button>
          </div>

          {/* PWA Install Button when eligible */}
          {!isInstalled && (isInstallable || isIOS) && (
            <button
              type="button"
              onClick={() => {
                if (isInstallable) {
                  void install();
                } else {
                  setShowIOSGuide(true);
                }
              }}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900/85 border border-cyan-400/35 text-cyan-200 text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>{isIOS ? 'Install on iPhone / iPad' : 'Install App for Offline Play'}</span>
            </button>
          )}
        </div>
      </section>

      {/* Subtle Bottom Control Hint */}
      <footer className="w-full text-center text-xs text-sky-100/70">
        Drag or Touch to Aim · Release to Shoot · Arrow Keys + Space Supported
      </footer>

      {showIOSGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Install on iPhone or iPad"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-white/15 p-6 text-white shadow-2xl">
            <h3 className="font-display text-lg font-bold">Install Prism Pop 3D</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              1. Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.
              <br />
              2. Scroll down and tap <strong>Add to Home Screen</strong>.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-cyan-400 text-slate-950 font-semibold text-sm cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
