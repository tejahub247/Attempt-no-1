import React, { useMemo, useState } from 'react';
import { ArrowLeft, Lock, Star } from 'lucide-react';
import { ALL_LEVELS } from '../game/levels';
import { PlayerProgress } from '../game/types';

interface LevelSelectScreenProps {
  progress: PlayerProgress;
  onSelectLevel: (levelNumber: number) => void;
  onBack: () => void;
}

const TIER_RANGES = [
  { label: '1–10', name: 'Tutorial', start: 1, end: 10 },
  { label: '11–20', name: 'Easy', start: 11, end: 20 },
  { label: '21–30', name: 'Beginner+', start: 21, end: 30 },
  { label: '31–40', name: 'Medium', start: 31, end: 40 },
  { label: '41–50', name: 'Challenging', start: 41, end: 50 },
  { label: '51–60', name: 'Hard', start: 51, end: 60 },
  { label: '61–70', name: 'Very Hard', start: 61, end: 70 },
  { label: '71–80', name: 'Expert', start: 71, end: 80 },
  { label: '81–90', name: 'Extreme', start: 81, end: 90 },
  { label: '91–100', name: 'Ultimate', start: 91, end: 100 },
];

export const LevelSelectScreen: React.FC<LevelSelectScreenProps> = ({
  progress,
  onSelectLevel,
  onBack,
}) => {
  const initialTier = Math.min(9, Math.floor((progress.currentLevel - 1) / 10));
  const [selectedTier, setSelectedTier] = useState<number>(initialTier);
  const [showAll, setShowAll] = useState<boolean>(false);

  const visibleLevels = useMemo(() => {
    if (showAll) return ALL_LEVELS;
    const range = TIER_RANGES[selectedTier];
    return ALL_LEVELS.filter(
      (lvl) => lvl.levelNumber >= range.start && lvl.levelNumber <= range.end
    );
  }, [selectedTier, showAll]);

  const totalStars = Object.values(progress.levelStats).reduce(
    (acc, s) => acc + (s.stars || 0),
    0
  );

  return (
    <main className="fixed inset-0 z-20 flex flex-col bg-slate-950/75 text-white overflow-hidden">
      {/* Header */}
      <header className="shrink-0 w-full max-w-5xl mx-auto px-4 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-white/10">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to home"
          className="min-h-[44px] px-3.5 rounded-xl bg-slate-900/90 border border-white/15 text-sm font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </button>

        <div className="text-center">
          <h1 className="font-display text-xl sm:text-2xl font-bold">
            100 Levels
          </h1>
          <p className="text-xs text-sky-200/80 tabular-nums">
            Unlocked {progress.unlockedLevel} / 100 · {totalStars} / 300 Stars
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="min-h-[44px] px-3.5 rounded-xl bg-slate-900/90 border border-white/15 text-xs sm:text-sm font-medium text-sky-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {showAll ? 'View by Tier' : 'Show All 100'}
        </button>
      </header>

      {/* Tier Filter Tabs */}
      {!showAll && (
        <nav
          aria-label="Difficulty tiers"
          className="shrink-0 w-full max-w-5xl mx-auto px-4 py-3 flex items-center gap-2 overflow-x-auto"
        >
          {TIER_RANGES.map((t, idx) => {
            const active = selectedTier === idx;
            return (
              <button
                key={t.label}
                type="button"
                onClick={() => setSelectedTier(idx)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-cyan-400 text-slate-950 shadow-sm'
                    : 'bg-slate-900/85 border border-white/15 text-slate-200 hover:bg-slate-800'
                }`}
              >
                {t.label} · {t.name}
              </button>
            );
          })}
        </nav>
      )}

      {/* Level Grid */}
      <section className="flex-1 overflow-y-auto px-4 py-4">
        <div className="w-full max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-5 gap-3 pb-8">
          {visibleLevels.map((lvl) => {
            const unlocked = lvl.levelNumber <= progress.unlockedLevel;
            const isCurrent = lvl.levelNumber === progress.currentLevel;
            const stats = progress.levelStats[lvl.levelNumber];
            const stars = stats?.stars ?? 0;

            return (
              <button
                key={lvl.levelNumber}
                type="button"
                disabled={!unlocked}
                onClick={() => onSelectLevel(lvl.levelNumber)}
                aria-label={
                  unlocked
                    ? `Play Level ${lvl.levelNumber}, ${lvl.tier}, ${stars} of 3 stars`
                    : `Level ${lvl.levelNumber} locked`
                }
                className={`min-h-[104px] p-3.5 rounded-2xl border flex flex-col items-center justify-between text-center transition-all ${
                  !unlocked
                    ? 'bg-slate-900/50 border-white/10 text-slate-500 cursor-not-allowed'
                    : isCurrent
                    ? 'bg-gradient-to-b from-sky-500/30 to-slate-900/95 border-cyan-400 text-white shadow-[0_0_24px_rgba(34,211,238,0.28)] cursor-pointer hover:brightness-110'
                    : 'bg-slate-900/90 border-white/15 text-white hover:border-sky-300/60 hover:bg-slate-800/95 cursor-pointer'
                }`}
              >
                <span className="text-[11px] font-medium text-sky-200/80 truncate w-full">
                  {lvl.tier}
                </span>

                <span className="font-display text-2xl font-bold tabular-nums">
                  {lvl.levelNumber}
                </span>

                {unlocked ? (
                  <div className="flex items-center gap-1" aria-hidden="true">
                    {[1, 2, 3].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${
                          s <= stars
                            ? 'text-amber-300 fill-amber-300'
                            : 'text-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                ) : (
                  <Lock className="w-4 h-4 text-slate-600" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
};
