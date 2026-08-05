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
    <div className="bg-surface-raised border-divider pointer-events-auto fixed bottom-0 left-1/2 flex min-h-[44px] max-w-[calc(100vw-300px)] -translate-x-1/2 items-center gap-1.5 rounded-t-2xl border px-2 py-1.5 shadow-xl sm:gap-3 sm:px-4 sm:py-2">
      <div className="flex max-w-24 min-w-0 flex-col leading-tight lg:max-w-48">
        <span className="text-muted text-[10px] font-bold tracking-wider">
          ROUND {round} · NOW
        </span>
        <span className="text-heading truncate text-sm font-semibold">
          {activeName}
        </span>
      </div>

      <Button
        variant="ghost"
        size="lg"
        aria-label="Previous turn"
        onClick={onPrev}
        className="min-h-[40px] min-w-[40px] px-2 sm:min-h-[44px] sm:min-w-[44px] sm:px-3"
      >
        <Rewind size={18} />
      </Button>

      <Button
        variant="primary"
        size="lg"
        onClick={onNext}
        rightIcon={<Play size={16} />}
        className="min-h-[40px] px-2 sm:min-h-[44px] sm:px-4"
      >
        Next
      </Button>
    </div>
  );
}
