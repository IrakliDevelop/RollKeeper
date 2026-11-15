'use client';

import { HPBar } from '@/components/shared/combat/HPBar';
import { Button } from '@/components/ui/forms/button';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { cn } from '@/utils/cn';
import { getHpNumberColor, getHpTierTextColor } from '@/utils/hpColor';
import { HP_STATUS_LABELS, hpStatus, hpTier } from '@/utils/hpState';

interface HpCardProps {
  hpCurrent: number;
  hpMax: number;
  hpTemp: number;
  hpPercent: number;
  amount: number | undefined;
  onAmountChange: (value: number | undefined) => void;
  onDamage: () => void;
  onHeal: () => void;
  onTemp: () => void;
}

/** Compact HP block: readout with status word, bar, and the damage/heal/temp
 * editor. Fixed input column + three equal flexible buttons so everything
 * always fits the dock's width. Renders no Tooltip: the map sheet drawer
 * shares it and mounts it without a TooltipProvider in its tests. */
export function HpCard({
  hpCurrent,
  hpMax,
  hpTemp,
  hpPercent,
  amount,
  onAmountChange,
  onDamage,
  onHeal,
  onTemp,
}: HpCardProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              'type-num-xl tabular-nums',
              hpMax > 0 ? getHpNumberColor(hpCurrent, hpMax) : 'text-heading'
            )}
          >
            {hpCurrent}
          </span>
          <span className="type-ui text-muted">/</span>
          <span className="type-ui text-muted tabular-nums">{hpMax}</span>
        </div>
        {hpTemp > 0 && (
          <span className="type-small text-frost-text">+{hpTemp} temp</span>
        )}
        {hpMax > 0 && (
          <span
            className={cn(
              'type-small ml-auto',
              getHpTierTextColor(hpTier(hpPercent))
            )}
          >
            {HP_STATUS_LABELS[hpStatus(hpCurrent, hpMax)]}
          </span>
        )}
      </div>
      <HPBar
        current={hpCurrent}
        max={hpMax}
        temp={hpTemp}
        size="sm"
        showLabel={false}
        className="w-full"
      />
      <div className="grid grid-cols-[3.5rem_repeat(3,minmax(0,1fr))] items-center gap-1.5">
        <NumberInput
          size="sm"
          allowEmpty
          min={0}
          value={amount}
          onChange={onAmountChange}
          aria-label="HP amount"
          wrapperClassName="min-w-0"
          className="px-1 text-center tabular-nums"
        />
        <Button
          variant="secondary"
          size="sm"
          className="text-blood-text min-w-0 px-1"
          onClick={onDamage}
        >
          Damage
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="text-verdigris-text min-w-0 px-1"
          onClick={onHeal}
        >
          Heal
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="min-w-0 px-1"
          onClick={onTemp}
        >
          Temp
        </Button>
      </div>
    </div>
  );
}
