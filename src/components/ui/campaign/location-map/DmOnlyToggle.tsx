'use client';

import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Tooltip } from '@/components/ui/primitives/Tooltip';
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
      ? 'DM only, hidden from players'
      : 'Visible to players';

  return (
    <Tooltip content={label}>
      <Button
        data-testid="dm-only-toggle"
        variant="ghost"
        size="sm"
        selected={isDmOnly}
        onClick={onToggle}
        aria-label={label}
        leftIcon={isDmOnly ? <EyeOff size={16} /> : <Eye size={16} />}
      >
        {isDmOnly ? 'DM only' : 'Visible'}
      </Button>
    </Tooltip>
  );
}
