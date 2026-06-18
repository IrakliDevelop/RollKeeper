'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Swords } from 'lucide-react';

interface CombatStartBannerProps {
  isVisible: boolean;
  onDone?: () => void;
  durationMs?: number;
}

/**
 * A non-blocking "Combat Begins" banner that sweeps into the center of the
 * screen, holds, then fades. `pointer-events-none` so it never blocks the sheet.
 * Rendered via portal at document.body. Self-dismisses after `durationMs`.
 */
export function CombatStartBanner({
  isVisible,
  onDone,
  durationMs = 2600,
}: CombatStartBannerProps) {
  const [render, setRender] = useState(false);
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter');

  useEffect(() => {
    if (!isVisible) return;
    setRender(true);
    setPhase('enter');
    const exitTimer = setTimeout(() => setPhase('exit'), durationMs - 700);
    const doneTimer = setTimeout(() => {
      setRender(false);
      onDone?.();
    }, durationMs);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [isVisible, durationMs, onDone]);

  if (!render) return null;

  const banner = (
    <>
      {/* Background blur — sits below the sidebars (z-55) so they stay sharp */}
      <div
        className={`pointer-events-none fixed inset-0 z-[50] backdrop-blur-sm ${
          phase === 'enter' ? 'combat-blur-enter' : 'combat-blur-exit'
        }`}
      />
      <div
        className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center"
        aria-live="polite"
      >
        <div
          className={`border-accent-red-border bg-surface-raised text-accent-red-text flex items-center gap-3 rounded-xl border-2 px-8 py-4 shadow-2xl ${
            phase === 'enter' ? 'combat-banner-enter' : 'combat-banner-exit'
          }`}
          style={{ fontFamily: 'var(--font-cinzel-decorative), serif' }}
        >
          <Swords size={28} />
          <span className="text-2xl font-bold tracking-widest uppercase sm:text-3xl">
            Combat Begins
          </span>
          <Swords size={28} className="-scale-x-100" />
        </div>

        <style jsx>{`
          .combat-banner-enter {
            animation: combatBannerIn 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)
              forwards;
          }
          .combat-banner-exit {
            animation: combatBannerOut 0.7s ease-in forwards;
          }
          .combat-blur-enter {
            animation: combatBlurIn 0.5s ease-out forwards;
          }
          .combat-blur-exit {
            animation: combatBlurOut 0.7s ease-in forwards;
          }
          @keyframes combatBlurIn {
            0% {
              opacity: 0;
            }
            100% {
              opacity: 1;
            }
          }
          @keyframes combatBlurOut {
            0% {
              opacity: 1;
            }
            100% {
              opacity: 0;
            }
          }
          @keyframes combatBannerIn {
            0% {
              opacity: 0;
              transform: translateY(-32px) scale(0.92);
            }
            60% {
              transform: translateY(4px) scale(1.02);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          @keyframes combatBannerOut {
            0% {
              opacity: 1;
              transform: scale(1);
            }
            100% {
              opacity: 0;
              transform: scale(1.06);
            }
          }
        `}</style>
      </div>
    </>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(banner, document.body);
}

export default CombatStartBanner;
