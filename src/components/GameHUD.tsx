import React from 'react';
import {
  ArrowLeftRight,
  Bomb,
  Calendar,
  Flame,
  Gem,
  Pause,
  PlusCircle,
  Sparkles,
  Zap,
} from 'lucide-react';
import { POWER_UP_COSTS } from '../game/rules';
import {
  ActiveShotKind,
  BUBBLE_COLORS,
  BubbleColor,
  LevelConfig,
  PlayerProgress,
  PowerUpType,
} from '../game/types';

interface GameHUDProps {
  level: LevelConfig;
  score: number;
  movesLeft: number;
  comboStreak: number;
  activeShot: ActiveShotKind;
  nextColor: BubbleColor;
  progress: PlayerProgress;
  canShoot: boolean;
  onPause: () => void;
  onSwapBubble: () => void;
  onUsePowerUp: (type: PowerUpType) => void;
}

const POWER_UP_ITEMS: Array<{
  type: PowerUpType;
  label: string;
  shortDesc: string;
  accent: string;
  icon: React.FC<{ className?: string }>;
}> = [
  {
    type: 'bomb',
    label: 'Bomb',
    shortDesc: 'Blast area',
    accent: 'border-rose-400/50 text-rose-200',
    icon: Bomb,
  },
  {
    type: 'rainbow',
    label: 'Rainbow',
    shortDesc: 'Any colour',
    accent: 'border-fuchsia-400/50 text-fuchsia-200',
    icon: Sparkles,
  },
  {
    type: 'fire',
    label: 'Fire',
    shortDesc: 'Clear line',
    accent: 'border-orange-400/50 text-orange-200',
    icon: Flame,
  },
  {
    type: 'lightning',
    label: 'Volt',
    shortDesc: 'Chain zap',
    accent: 'border-cyan-400/50 text-cyan-200',
    icon: Zap,
  },
  {
    type: 'extraMoves',
    label: '+5 Moves',
    shortDesc: 'Add shots',
    accent: 'border-emerald-400/50 text-emerald-200',
    icon: PlusCircle,
  },
];

export const GameHUD: React.FC<GameHUDProps> = ({
  level,
  score,
  movesLeft,
  comboStreak,
  activeShot,
  nextColor,
  progress,
  canShoot,
  onPause,
  onSwapBubble,
  onUsePowerUp,
}) => {
  const nextSpec = BUBBLE_COLORS[nextColor];
  const lowMoves = movesLeft <= 5;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between px-3 py-2.5 sm:px-6 sm:py-4 select-none">
      {/* Top Perimeter HUD */}
      <header className="w-full max-w-3xl mx-auto flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 bg-slate-950/88 border border-white/15 rounded-2xl px-3 py-2 shadow-lg pointer-events-auto">
          {/* Level / Daily Badge */}
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-medium text-sky-300 truncate">
              {level.isDailyChallenge ? (
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <Calendar className="w-3 h-3" aria-hidden="true" />
                  Daily Challenge
                </span>
              ) : (
                level.tier
              )}
            </span>
            <span className="font-display text-base sm:text-lg font-bold text-white leading-tight tabular-nums">
              {level.isDailyChallenge
                ? level.specialCondition?.label
                : `Level ${level.levelNumber}`}
            </span>
          </div>

          {/* Score & Moves Readout */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Score
              </div>
              <div
                data-testid="hud-score"
                className="font-display text-lg sm:text-xl font-bold text-white tabular-nums leading-tight"
              >
                {score.toLocaleString()}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Moves
              </div>
              <div
                data-testid="hud-moves"
                className={`font-display text-lg sm:text-xl font-bold tabular-nums leading-tight ${
                  lowMoves ? 'text-rose-400' : 'text-cyan-300'
                }`}
              >
                {movesLeft}
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              aria-label="Pause game"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-800/95 border border-white/15 text-white hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
            >
              <Pause className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Optional Live Combo or Daily Modifier Sub-line */}
        {(comboStreak >= 2 || level.isDailyChallenge) && (
          <div className="flex items-center justify-between px-2 text-xs font-semibold">
            {level.isDailyChallenge ? (
              <span className="text-amber-200/95 bg-slate-950/75 px-2.5 py-0.5 rounded-lg border border-amber-400/25">
                {level.specialCondition?.description}
              </span>
            ) : (
              <span />
            )}
            {comboStreak >= 2 && (
              <span className="text-amber-300 bg-slate-950/80 px-2.5 py-0.5 rounded-lg border border-amber-300/35 tabular-nums">
                {comboStreak}x Combo Streak
              </span>
            )}
          </div>
        )}
      </header>

      {/* Bottom Perimeter Dock: Swap + 5 Power-Ups */}
      <footer className="w-full max-w-2xl mx-auto grid grid-cols-6 items-stretch gap-1 sm:gap-2 bg-slate-950/90 border border-white/15 rounded-2xl p-1.5 sm:px-3 sm:py-2 shadow-xl pointer-events-auto">
        {/* Next Bubble + Swap */}
        <button
          type="button"
          disabled={!canShoot || activeShot.kind !== 'color'}
          onClick={(e) => {
            e.currentTarget.blur();
            onSwapBubble();
          }}
          aria-label={`Swap bubble with next ${nextSpec.label} bubble`}
          className="min-h-[48px] min-w-0 px-1 sm:px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/15 flex items-center justify-center gap-1 sm:gap-2 hover:bg-slate-800 disabled:opacity-50 active:scale-95 transition-all cursor-pointer"
        >
          <span
            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-white/40 shadow-inner shrink-0"
            style={{
              background: `radial-gradient(circle at 32% 30%, #ffffff 0%, ${nextSpec.css} 45%, #0f172a 100%)`,
            }}
            aria-hidden="true"
          />
          <div className="hidden sm:flex flex-col text-left leading-none">
            <span className="text-[10px] text-slate-400">Next</span>
            <span className="text-xs font-semibold text-white mt-0.5">Swap</span>
          </div>
          <ArrowLeftRight className="w-3.5 h-3.5 text-sky-300 shrink-0" aria-hidden="true" />
        </button>

        {/* 5 Power-Up Buttons */}
        {POWER_UP_ITEMS.map(({ type, label, accent, icon: Icon }) => {
          const count = progress.powerUps[type] ?? 0;
          const cost = POWER_UP_COSTS[type];
          const isArmed = activeShot.kind === type;
          const canBuy = count === 0 && progress.coins >= cost;

          return (
            <button
              key={type}
              type="button"
              disabled={!canShoot || (count === 0 && !canBuy)}
              onClick={(e) => {
                e.currentTarget.blur();
                onUsePowerUp(type);
              }}
              aria-label={
                count > 0
                  ? `Activate ${label} power-up (${count} left)`
                  : `Buy ${label} power-up for ${cost} Gems`
              }
              aria-pressed={isArmed}
              className={`relative min-h-[48px] min-w-0 px-1 sm:px-2 py-1.5 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isArmed
                  ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_16px_rgba(251,191,36,0.6)] scale-105'
                  : `bg-slate-900 ${accent} hover:bg-slate-800 active:scale-95`
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="text-[9px] sm:text-[10px] font-semibold leading-none truncate max-w-full">
                {label}
              </span>
              <span
                className={`text-[9px] sm:text-[10px] font-bold tabular-nums leading-none ${
                  isArmed
                    ? 'text-slate-900'
                    : count > 0
                    ? 'text-white'
                    : 'text-amber-300 inline-flex items-center gap-0.5'
                }`}
              >
                {count > 0 ? (
                  `x${count}`
                ) : (
                  <>
                    <Gem className="w-2.5 h-2.5" aria-hidden="true" />
                    {cost}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </footer>
    </div>
  );
};
