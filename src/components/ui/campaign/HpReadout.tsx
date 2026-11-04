import { HPBar } from '@/components/shared/combat/HPBar';
import { cn } from '@/utils/cn';
import { getHpNumberColor, getHpTierTextColor } from '@/utils/hpColor';
import { HP_STATUS_LABELS, hpPercent, hpStatus, hpTier } from '@/utils/hpState';

export interface HpReadoutProps {
  current: number;
  max: number;
  temp?: number;
  size?: 'md' | 'sm';
  className?: string;
}

/** Current / max HP with temporary HP, a status word and a thin bar. */
export function HpReadout({
  current,
  max,
  temp = 0,
  size = 'md',
  className,
}: HpReadoutProps) {
  const statusColor = getHpTierTextColor(hpTier(hpPercent(current, max)));
  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span
          className={cn(
            size === 'md' ? 'type-num-md' : 'type-ui',
            'tabular-nums',
            getHpNumberColor(current, max)
          )}
        >
          {current}
        </span>
        <span className="type-small text-muted tabular-nums">/ {max} HP</span>
        {temp > 0 && (
          <span className="type-small text-frost-text tabular-nums">
            +{temp} temp HP
          </span>
        )}
        <span className={cn('type-small ml-auto', statusColor)}>
          {HP_STATUS_LABELS[hpStatus(current, max)]}
        </span>
      </div>
      <HPBar
        current={current}
        max={max}
        size="sm"
        showLabel={false}
        className="mt-1"
      />
    </div>
  );
}
