import { Rewind, Play } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Tooltip } from '@/components/ui/primitives/Tooltip';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';

import { cn } from '@/utils/cn';

interface TurnControlProps {
  round: number;
  activeName: string;
  onNext: () => void;
  onPrev: () => void;
}

/**
 * Bottom-center bar showing the current round/turn and driving
 * next/previous turn — an overlay surface docked to the bottom edge, like
 * `RosterTray`/`StudioPanel` on their edges. The Tooltip needs the
 * `TooltipProvider` that `DmVttScreen` wraps around the floating panels.
 */
export function TurnControl({
  round,
  activeName,
  onNext,
  onPrev,
}: TurnControlProps) {
  return (
    <div
      className={cn(
        OVERLAY_SURFACE,
        'pointer-events-auto fixed bottom-0 left-1/2 flex max-w-[calc(100vw-300px)] -translate-x-1/2 items-center gap-2 rounded-b-none border-b-0 px-2 py-1.5 sm:px-3'
      )}
    >
      <div className="flex max-w-24 min-w-0 flex-col leading-tight lg:max-w-48">
        <span className="type-small text-muted whitespace-nowrap">
          Round {round}
        </span>
        <span className="type-ui text-heading truncate">{activeName}</span>
      </div>

      <Tooltip content="Previous turn">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Previous turn"
          onClick={onPrev}
          className="w-9 shrink-0 px-0"
        >
          <Rewind size={16} />
        </Button>
      </Tooltip>

      <Button
        variant="primary"
        size="sm"
        onClick={onNext}
        rightIcon={<Play size={16} />}
        className="shrink-0 whitespace-nowrap"
      >
        Next turn
      </Button>
    </div>
  );
}
