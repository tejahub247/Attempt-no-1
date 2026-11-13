import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const LOGO_IMAGE_PATH = '/assets/aistudio/IMG_20261012_202027_43ff7e64.jpg';

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const t1 = window.setTimeout(() => setProgress(56), 240);
    const t2 = window.setTimeout(() => setProgress(92), 620);
    const t3 = window.setTimeout(() => setProgress(100), 920);
    const t4 = window.setTimeout(() => onComplete(), 1250);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [onComplete]);

  return (
    <main className="fixed inset-0 z-20 flex flex-col items-center justify-center px-6 py-10 bg-slate-950/55 text-white select-none">
      <div className="flex flex-col items-center max-w-sm w-full text-center">
        {/* Official Application Logo */}
        <div className="relative p-1.5 rounded-full bg-gradient-to-tr from-cyan-400 via-fuchsia-400 to-amber-300 shadow-[0_0_48px_rgba(56,189,248,0.45)]">
          <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden bg-slate-950 border-2 border-white/25">
            <img
              src={LOGO_IMAGE_PATH}
              alt="Prism Pop 3D Official Logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-[50%_45%]"
            />
          </div>
        </div>

        <h1 className="mt-7 font-display text-4xl sm:text-5xl font-bold tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.65)]">
          Prism Pop 3D
        </h1>
        <p className="mt-2 text-sm text-sky-100/85 tracking-wide">
          Iridescent 3D Bubble Adventure · 100 Levels
        </p>

        {/* Loading Progress Bar */}
        <div
          className="mt-8 w-full max-w-[260px]"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Loading game"
        >
          <div className="h-2.5 w-full rounded-full bg-slate-900/90 border border-white/15 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-amber-300 transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-sky-200/80 tabular-nums">
            <span>Preparing 3D Arena</span>
            <span>{progress}%</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onComplete}
          className="mt-6 min-h-[44px] px-5 py-2 text-sm font-medium text-sky-100/90 hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
        >
          Continue
        </button>
      </div>
    </main>
  );
};
