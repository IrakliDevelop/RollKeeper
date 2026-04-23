'use client';

import { Heart } from 'lucide-react';
import { Input } from '@/components/ui/forms/input';
import { calculateModifier } from '@/utils/calculations';

interface HPStepProps {
  hitDie: number;
  constitutionScore: number;
  hpRollResult: number | undefined;
  onRollResultChange: (result: number | undefined) => void;
}

export default function HPStep({
  hitDie,
  constitutionScore,
  hpRollResult,
  onRollResultChange,
}: HPStepProps) {
  const conMod = calculateModifier(constitutionScore);
  const average = Math.ceil(hitDie / 2) + 1;
  const totalGain = hpRollResult !== undefined ? hpRollResult + conMod : null;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-heading text-lg font-semibold">Hit Points</h3>
        <p className="text-muted mt-1 text-sm">
          Roll your d{hitDie} or take the average ({average}).
        </p>
      </div>

      <div className="border-divider bg-surface-raised mx-auto max-w-xs rounded-lg border p-4">
        <div className="flex items-center justify-center gap-2">
          <Heart size={18} className="text-accent-red-text" />
          <label className="text-heading text-sm font-medium">
            Hit Die Roll (d{hitDie})
          </label>
        </div>

        <div className="mt-3 flex items-center justify-center gap-3">
          <Input
            type="number"
            min={1}
            max={hitDie}
            value={hpRollResult ?? ''}
            onChange={e => {
              const val = e.target.value;
              onRollResultChange(val ? parseInt(val, 10) : undefined);
            }}
            placeholder={`1-${hitDie}`}
            className="w-24 text-center"
          />
        </div>

        {totalGain !== null && (
          <div className="text-muted mt-3 space-y-1 text-center text-xs">
            <p>
              Roll: {hpRollResult} + CON modifier: {conMod >= 0 ? '+' : ''}
              {conMod}
            </p>
            <p className="text-accent-emerald-text text-sm font-semibold">
              Total HP gained: +{Math.max(1, totalGain)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
