'use client';

import React from 'react';
import { Button } from '@/components/ui/forms';
import { Section } from '@/components/ui/layout/section';
import { HitDicePools } from '@/types/character';

interface HitDiceTrackerProps {
  hitDicePools: HitDicePools;
  onUseHitDie: (dieType: string, count?: number) => void;
  onRestoreHitDice: (dieType: string, count?: number) => void;
  onResetAllHitDice: () => void;
}

export default function HitDiceTracker({
  hitDicePools,
  onUseHitDie,
  onRestoreHitDice,
  onResetAllHitDice,
}: HitDiceTrackerProps) {
  const dieTypes = Object.keys(hitDicePools).sort(
    (a, b) => Number(a.slice(1)) - Number(b.slice(1))
  );
  return (
    <Section heading="Hit dice" level={3}>
      {dieTypes.length === 0 && (
        <p className="type-body text-muted">
          Add a class level to get hit dice.
        </p>
      )}
      <div className="divide-divider divide-y">
        {dieTypes.map(dieType => {
          const pool = hitDicePools[dieType];
          const available = pool.max - pool.used;
          return (
            <div
              key={dieType}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2"
              role="group"
              aria-label={`${dieType} hit dice: ${available} of ${pool.max} available`}
            >
              <span className="type-num-md text-heading w-8">{dieType}</span>
              <div className="flex flex-wrap">
                {Array.from({ length: pool.max }, (_, index) => {
                  const filled = index < available;
                  return (
                    <button
                      key={index}
                      type="button"
                      aria-label={`${filled ? 'Use' : 'Restore'} a ${dieType} hit die`}
                      onClick={() =>
                        filled
                          ? onUseHitDie(dieType, 1)
                          : onRestoreHitDice(dieType, 1)
                      }
                      className="focus-visible:outline-brass-border inline-flex size-6 cursor-pointer items-center justify-center rounded-sm focus-visible:outline-2 pointer-coarse:size-11"
                    >
                      <span
                        aria-hidden="true"
                        className={`border-divider-strong size-3 rounded-full border ${filled ? 'bg-heading' : 'bg-transparent'}`}
                      />
                    </button>
                  );
                })}
              </div>
              <span className="type-ui text-body tabular-nums">
                {available} / {pool.max}{' '}
                <span className="type-small text-muted">available</span>
              </span>
            </div>
          );
        })}
      </div>
      {dieTypes.length > 0 && (
        <div className="mt-3">
          <Button size="sm" onClick={onResetAllHitDice}>
            Restore all hit dice
          </Button>
        </div>
      )}
    </Section>
  );
}
