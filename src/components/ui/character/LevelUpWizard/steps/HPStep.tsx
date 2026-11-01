'use client';

import { NumberInput } from '@/components/ui/forms/NumberInput';
import { calculateModifier } from '@/utils/calculations';

interface HPStepProps {
  hitDie: number;
  constitutionScore: number;
  hpRollResult: number | undefined;
  onRollResultChange: (result: number | undefined) => void;
  hpGained?: number;
  retroactiveHp?: number;
  newLevelHp?: number;
  minimumAdjustment?: number;
}

export default function HPStep({
  hitDie,
  constitutionScore,
  hpRollResult,
  onRollResultChange,
  hpGained,
  retroactiveHp = 0,
  newLevelHp,
  minimumAdjustment = 0,
}: HPStepProps) {
  const conMod = calculateModifier(constitutionScore);
  const average = Math.ceil(hitDie / 2) + 1;
  return (
    <div className="space-y-5">
      <div>
        <h3 className="type-subheading text-heading">Hit points</h3>
        <p className="type-body text-muted mt-1">
          Roll your d{hitDie} or take the average ({average}).
        </p>
      </div>
      <div className="border-divider space-y-3 border-t pt-3">
        <label
          htmlFor="level-up-hit-die"
          className="type-ui text-heading block font-semibold"
        >
          Hit die roll (d{hitDie})
        </label>
        <NumberInput
          id="level-up-hit-die"
          min={1}
          max={hitDie}
          allowEmpty
          value={hpRollResult}
          onChange={onRollResultChange}
          placeholder={`1-${hitDie}`}
          className="w-24"
        />
        {hpRollResult !== undefined && hpGained !== undefined && (
          <div className="space-y-1">
            <p className="type-caption text-muted">
              Roll: {hpRollResult} + CON modifier: {conMod >= 0 ? '+' : ''}
              {conMod}
            </p>
            {newLevelHp !== undefined && (
              <p className="type-caption text-muted">
                This level: +{newLevelHp} HP
                {hpRollResult + conMod < 1 ? ' (minimum 1)' : ''}
              </p>
            )}
            {retroactiveHp !== 0 && (
              <p className="type-caption text-muted">
                Earlier levels (CON): {retroactiveHp > 0 ? '+' : ''}
                {retroactiveHp} HP
              </p>
            )}
            {minimumAdjustment !== 0 && (
              <p className="type-caption text-muted">
                Max HP can&apos;t go below 1: +{minimumAdjustment} HP
              </p>
            )}
            <p
              className={`type-ui font-semibold ${hpGained > 0 ? 'text-verdigris-text' : 'text-heading'}`}
            >
              Total HP gained: {hpGained >= 0 ? '+' : ''}
              {hpGained}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
