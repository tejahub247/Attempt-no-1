import React, { useState } from 'react';
import {
  ArrowRight,
  Flame,
  Gem,
  Home,
  Music,
  Play,
  RotateCcw,
  Star,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { LevelConfig, PlayerProgress } from '../game/types';

interface PauseModalProps {
  level: LevelConfig;
  soundEnabled: boolean;
  musicEnabled: boolean;
  onResume: () => void;
  onRestart: () => void;
  onHome: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  level,
  soundEnabled,
  musicEnabled,
  onResume,
  onRestart,
  onHome,
  onToggleSound,
  onToggleMusic,
}) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Game Paused"
    className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4"
  >
    <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-white/15 p-6 text-white shadow-2xl">
      <h2 className="font-display text-2xl font-bold text-center">Game Paused</h2>
      <p className="mt-1 text-xs text-center text-sky-200/80">
        {level.isDailyChallenge
          ? `Daily Challenge · ${level.specialCondition?.label}`
          : `Level ${level.levelNumber} · ${level.tier}`}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onToggleSound}
          className="min-h-[44px] px-3 rounded-xl bg-slate-800 border border-white/10 text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-700 cursor-pointer"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-300" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          <span>{soundEnabled ? 'SFX On' : 'SFX Off'}</span>
        </button>
        <button
          type="button"
          onClick={onToggleMusic}
          className="min-h-[44px] px-3 rounded-xl bg-slate-800 border border-white/10 text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-700 cursor-pointer"
        >
          <Music className={`w-4 h-4 ${musicEnabled ? 'text-fuchsia-300' : 'text-slate-400'}`} />
          <span>{musicEnabled ? 'Music On' : 'Music Off'}</span>
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onResume}
          className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-display text-base font-bold flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer"
        >
          <Play className="w-5 h-5 fill-slate-950" />
          <span>Resume</span>
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="w-full min-h-[44px] rounded-2xl bg-slate-800 border border-white/15 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-slate-700 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Restart Level</span>
        </button>
        <button
          type="button"
          onClick={onHome}
          className="w-full min-h-[44px] rounded-2xl bg-slate-950 border border-white/10 text-slate-300 font-semibold text-sm flex items-center justify-center gap-2 hover:text-white cursor-pointer"
        >
          <Home className="w-4 h-4" />
          <span>Return to Home</span>
        </button>
      </div>
    </div>
  </div>
);

interface VictoryModalProps {
  level: LevelConfig;
  finalScore: number;
  movesBonus: number;
  starsEarned: number;
  coinsEarned: number;
  dailyStreak?: number;
  hasNextLevel: boolean;
  onNextLevel: () => void;
  onReplay: () => void;
  onHome: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  level,
  finalScore,
  movesBonus,
  starsEarned,
  coinsEarned,
  dailyStreak,
  hasNextLevel,
  onNextLevel,
  onReplay,
  onHome,
}) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Level Complete"
    className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4"
  >
    <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-amber-300/35 p-6 text-white shadow-2xl text-center">
      <div className="text-xs font-semibold text-amber-300">
        {level.isDailyChallenge ? 'Daily Challenge Complete' : `Level ${level.levelNumber} Cleared`}
      </div>
      <h2 className="mt-1 font-display text-3xl font-bold">Victory!</h2>

      {/* 3-Star Rating */}
      <div className="mt-5 flex items-center justify-center gap-3" aria-label={`${starsEarned} of 3 stars earned`}>
        {[1, 2, 3].map((s) => (
          <Star
            key={s}
            className={`w-11 h-11 transition-transform duration-300 ${
              s <= starsEarned
                ? 'text-amber-300 fill-amber-300 scale-110 drop-shadow-[0_0_16px_rgba(252,211,77,0.65)]'
                : 'text-slate-700'
            }`}
          />
        ))}
      </div>

      {/* Metrics */}
      <div className="mt-5 grid grid-cols-2 gap-3 text-left">
        <div className="rounded-2xl bg-slate-950/80 border border-white/10 p-3">
          <div className="text-[11px] text-slate-400">Final Score</div>
          <div className="mt-0.5 font-display text-xl font-bold tabular-nums text-white">
            {finalScore.toLocaleString()}
          </div>
          {movesBonus > 0 && (
            <div className="text-[11px] text-cyan-300 tabular-nums">
              +{movesBonus} moves bonus
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-slate-950/80 border border-white/10 p-3">
          <div className="text-[11px] text-slate-400">Reward Earned</div>
          <div className="mt-0.5 font-display text-xl font-bold tabular-nums text-amber-300 flex items-center gap-1.5">
            <Gem className="w-4 h-4 text-cyan-300" aria-hidden="true" />
            <span>+{coinsEarned}</span>
          </div>
          {level.isDailyChallenge && dailyStreak && dailyStreak > 0 && (
            <div className="text-[11px] text-orange-300 flex items-center gap-1 tabular-nums">
              <Flame className="w-3 h-3" aria-hidden="true" />
              <span>{dailyStreak} day streak</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        {hasNextLevel && !level.isDailyChallenge && (
          <button
            type="button"
            data-start="true"
            onClick={onNextLevel}
            className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-display text-base font-bold flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer"
          >
            <span>Next Level ({level.levelNumber + 1})</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
        <button
          type="button"
          onClick={onReplay}
          className="w-full min-h-[44px] rounded-2xl bg-slate-800 border border-white/15 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-slate-700 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Replay</span>
        </button>
        <button
          type="button"
          onClick={onHome}
          className="w-full min-h-[44px] rounded-2xl bg-slate-950 border border-white/10 text-slate-300 font-semibold text-sm flex items-center justify-center gap-2 hover:text-white cursor-pointer"
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </button>
      </div>
    </div>
  </div>
);

interface GameOverModalProps {
  level: LevelConfig;
  score: number;
  reason: 'moves' | 'overflow';
  onRetry: () => void;
  onHome: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  level,
  score,
  reason,
  onRetry,
  onHome,
}) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Level Failed"
    className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4"
  >
    <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-rose-400/35 p-6 text-white shadow-2xl text-center">
      <div className="text-xs font-semibold text-rose-300">
        {level.isDailyChallenge ? 'Daily Challenge' : `Level ${level.levelNumber}`}
      </div>
      <h2 className="mt-1 font-display text-3xl font-bold">Out of Moves</h2>
      <p className="mt-1.5 text-sm text-slate-300">
        {reason === 'overflow'
          ? 'Bubbles crossed the danger barrier!'
          : 'You ran out of shooting moves before clearing the board.'}
      </p>

      <div className="mt-5 rounded-2xl bg-slate-950/80 border border-white/10 p-4">
        <div className="text-xs text-slate-400">Score Reached</div>
        <div className="mt-1 font-display text-2xl font-bold tabular-nums text-white">
          {score.toLocaleString()}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        <button
          type="button"
          data-start="true"
          onClick={onRetry}
          className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-rose-400 to-orange-500 text-slate-950 font-display text-base font-bold flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer"
        >
          <RotateCcw className="w-5 h-5" />
          <span>Retry Level</span>
        </button>
        <button
          type="button"
          onClick={onHome}
          className="w-full min-h-[44px] rounded-2xl bg-slate-800 border border-white/15 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-slate-700 cursor-pointer"
        >
          <Home className="w-4 h-4" />
          <span>Return to Home</span>
        </button>
      </div>
    </div>
  </div>
);

interface SettingsModalProps {
  progress: PlayerProgress;
  onClose: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onToggleAimGuide: () => void;
  onResetProgress: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  progress,
  onClose,
  onToggleSound,
  onToggleMusic,
  onToggleAimGuide,
  onResetProgress,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4"
    >
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-white/15 p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <div className="flex items-center justify-between py-2 border-b border-white/10">
            <span className="text-sm font-medium">Sound Effects</span>
            <button
              type="button"
              onClick={onToggleSound}
              aria-pressed={progress.soundEnabled}
              className={`min-h-[40px] px-4 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                progress.soundEnabled
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {progress.soundEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-white/10">
            <span className="text-sm font-medium">Background Music</span>
            <button
              type="button"
              onClick={onToggleMusic}
              aria-pressed={progress.musicEnabled}
              className={`min-h-[40px] px-4 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                progress.musicEnabled
                  ? 'bg-fuchsia-400 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {progress.musicEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-white/10">
            <span className="text-sm font-medium">Aiming Trajectory Guide</span>
            <button
              type="button"
              onClick={onToggleAimGuide}
              aria-pressed={progress.aimGuideEnabled}
              className={`min-h-[40px] px-4 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                progress.aimGuideEnabled
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {progress.aimGuideEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        <div className="mt-6">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="w-full min-h-[44px] rounded-xl bg-slate-950 border border-rose-500/35 text-rose-300 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-rose-950/40 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Reset Saved Progress</span>
            </button>
          ) : (
            <div className="flex flex-col gap-2 p-3 rounded-2xl bg-rose-950/40 border border-rose-400/40">
              <p className="text-xs text-rose-200 text-center">
                Reset all unlocked levels, stars, and gems?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="min-h-[40px] rounded-xl bg-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResetProgress();
                    setConfirmReset(false);
                    onClose();
                  }}
                  className="min-h-[40px] rounded-xl bg-rose-500 text-white text-xs font-bold cursor-pointer"
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
