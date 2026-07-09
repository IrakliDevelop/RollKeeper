import { Rewind, Play } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';

interface TurnControlProps {
  round: number;
  activeName: string;
  onNext: () => void;
  onPrev: () => void;
}

/**
 * Bottom-center pill showing the current round/turn and driving
 * next/previous turn — mirrors the fixed-pill styling used by
 * `RosterTray`/`StudioPanel` elsewhere in the DM VTT studio.
 */
export function TurnControl({
  round,
  activeName,
  onNext,
  onPrev,
}: TurnControlProps) {
  return (
    <div className="bg-surface-raised border-divider pointer-events-auto fixed bottom-6 left-1/2 flex min-h-[44px] -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-2 shadow-xl">
      <div className="flex flex-col leading-tight">
        <span className="text-muted text-[10px] font-bold tracking-wider">
          ROUND {round} · NOW
        </span>
        <span className="text-heading text-sm font-semibold">{activeName}</span>
      </div>

      <Button
        variant="ghost"
        size="lg"
        aria-label="Previous turn"
        onClick={onPrev}
        className="min-h-[44px] min-w-[44px] px-3"
      >
        <Rewind size={18} />
      </Button>

      <Button
        variant="primary"
        size="lg"
        onClick={onNext}
        rightIcon={<Play size={16} />}
        className="min-h-[44px]"
      >
        Next
      </Button>
    </div>
  );
}
