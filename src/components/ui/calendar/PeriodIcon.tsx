import { Clock, Moon, Sun, Sunrise, Sunset } from 'lucide-react';

interface PeriodIconProps {
  period: string;
  size?: number;
}

/** A neutral icon for the part of the day. */
export function PeriodIcon({ period, size = 16 }: PeriodIconProps) {
  const props = {
    size,
    className: 'text-muted shrink-0',
    'aria-hidden': true as const,
  };
  switch (period) {
    case 'Morning':
      return <Sunrise {...props} />;
    case 'Afternoon':
      return <Sun {...props} />;
    case 'Evening':
      return <Sunset {...props} />;
    case 'Night':
      return <Moon {...props} />;
    default:
      return <Clock {...props} />;
  }
}
