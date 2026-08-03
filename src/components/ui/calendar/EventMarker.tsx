import { cn } from '@/utils/cn';
import type { CalendarEvent } from '@/types/calendar';

export const DEFAULT_EVENT_COLOR = '#3b82f6';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(
  color: string | undefined | null
): color is string {
  return !!color && HEX_COLOR_RE.test(color);
}

interface EventMarkerProps {
  event: Pick<CalendarEvent, 'color' | 'emoji'>;
  size: 'grid' | 'row';
  className?: string;
}

/**
 * Single source of truth for event marker rendering.
 * Precedence: non-empty emoji > valid hex color > default blue.
 * Decorative only — the event title carries the meaning.
 */
export function EventMarker({ event, size, className }: EventMarkerProps) {
  if (event.emoji) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'leading-none',
          size === 'grid' ? 'text-[11px]' : 'text-sm',
          className
        )}
      >
        {event.emoji}
      </span>
    );
  }

  const color = isValidHexColor(event.color)
    ? event.color
    : DEFAULT_EVENT_COLOR;

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block shrink-0 rounded-full',
        size === 'grid' ? 'h-1.5 w-1.5' : 'h-2 w-2',
        className
      )}
      style={{ backgroundColor: color }}
    />
  );
}
