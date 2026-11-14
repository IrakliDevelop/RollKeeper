'use client';

import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Tooltip } from '@/components/ui/primitives/Tooltip';

interface ToolbarButtonProps {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** A toggle's on state. Leave undefined for an action (no `aria-pressed`). */
  active?: boolean;
  disabled?: boolean;
}

/**
 * One icon tool in a rich-text toolbar: a ghost icon button named by its
 * label, with the same label in a Tooltip. Render inside a TooltipProvider.
 */
export function ToolbarButton({
  label,
  icon: Icon,
  onClick,
  active,
  disabled,
}: ToolbarButtonProps) {
  return (
    <Tooltip content={label}>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        className="w-9 shrink-0 px-0"
        aria-label={label}
        selected={active ?? false}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon size={16} aria-hidden />
      </Button>
    </Tooltip>
  );
}
