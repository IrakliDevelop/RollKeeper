'use client';

import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { markerAudienceToggleTitle } from './markerAudienceCopy';

interface DmOnlyToggleProps {
  isDmOnly: boolean;
  onToggle: () => void;
  /**
   * The selected element is a marker. Changes the copy only: sharing a marker
   * also publishes its kind, label and colour (spec §7.4), and the change
   * applies to every sibling pin sharing its ref — both facts have to be on
   * the control that does it.
   */
  isMarker?: boolean;
}

export default function DmOnlyToggle({
  isDmOnly,
  onToggle,
  isMarker = false,
}: DmOnlyToggleProps) {
  const label = isMarker
    ? markerAudienceToggleTitle(isDmOnly)
    : isDmOnly
      ? 'DM Only — hidden from players'
      : 'Visible to players';

  return (
    <Button
      data-testid="dm-only-toggle"
      variant={isDmOnly ? 'warning' : 'ghost'}
      onClick={onToggle}
      title={label}
      aria-label={label}
      className="flex items-center gap-1 px-2 py-1 text-xs"
    >
      {isDmOnly ? <EyeOff size={14} /> : <Eye size={14} />}
      <span className="hidden sm:inline">
        {isDmOnly ? 'DM Only' : 'Visible'}
      </span>
    </Button>
  );
}
