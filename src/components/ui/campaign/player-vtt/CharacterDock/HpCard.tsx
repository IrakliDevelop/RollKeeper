'use client';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Badge } from '@/components/ui/layout/badge';
import { getHpBarColor } from '@/utils/hpColor';
import { getHpCardClasses } from './DockVitals.utils';

interface HpCardProps {
  hpCurrent: number;
  hpMax: number;
  hpTemp: number;
  hpPercent: number;
  amount: string;
  onAmountChange: (value: string) => void;
  onDamage: () => void;
  onHeal: () => void;
  onTemp: () => void;
}

/** Compact HP card: readout, bar, and the damage/heal/temp editor in one
 * tinted card. Fixed input column + three equal flexible buttons so
 * everything always fits the dock's width (a plain flex row clipped Temp). */
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
    <div className={`rounded-xl border p-3 ${getHpCardClasses(hpPercent)}`}>
      <div className="flex items-baseline gap-2">
        <span className="text-heading text-2xl font-bold">
          {hpCurrent}/{hpMax}
        </span>
        {hpTemp > 0 && <Badge variant="info">+{hpTemp} temp</Badge>}
      </div>
      <div className="bg-surface-secondary mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full ${getHpBarColor(hpCurrent, hpMax)}`}
          style={{ width: `${Math.min(100, Math.max(0, hpPercent))}%` }}
        />
      </div>
      <div className="mt-2 grid grid-cols-[3.5rem_repeat(3,minmax(0,1fr))] items-center gap-1.5">
        <Input
          aria-label="HP amount"
          inputMode="numeric"
          value={amount}
          onChange={e => onAmountChange(e.target.value)}
          className="w-full min-w-0"
        />
        <Button
          variant="danger"
          size="lg"
          className="min-w-0 px-1 text-xs"
          onClick={onDamage}
        >
          Damage
        </Button>
        <Button
          variant="success"
          size="lg"
          className="min-w-0 px-1 text-xs"
          onClick={onHeal}
        >
          Heal
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="min-w-0 px-1 text-xs"
          onClick={onTemp}
        >
          Temp
        </Button>
      </div>
    </div>
  );
}
