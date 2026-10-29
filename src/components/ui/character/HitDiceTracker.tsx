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
    <Section
      heading="Hit dice"
      level={3}
      trailing={
        dieTypes.length > 0 && (
          <Button size="sm" onClick={onResetAllHitDice}>
            Restore all hit dice
          </Button>
        )
      }
    >
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
              className="space-y-3 py-3"
              role="group"
              aria-label={`${dieType} hit dice: ${available} of ${pool.max} available`}
            >
              <div className="flex items-center justify-between gap-4">
                <span className="type-num-md text-heading">{dieType}</span>
                <span className="type-ui text-body">
                  {available} / {pool.max}{' '}
                  <span className="type-small text-muted">available</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
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
              <div className="flex flex-wrap gap-2">
                <Button
                  size="xs"
                  disabled={available === 0}
                  aria-label={`Use 1 ${dieType} hit die`}
                  onClick={() => onUseHitDie(dieType, 1)}
                >
                  Use 1
                </Button>
                {available > 1 && (
                  <Button
                    size="xs"
                    aria-label={`Use ${Math.min(available, 5)} ${dieType} hit dice`}
                    onClick={() => onUseHitDie(dieType, Math.min(available, 5))}
                  >
                    Use {Math.min(available, 5)}
                  </Button>
                )}
                {pool.used > 0 && (
                  <>
                    <Button
                      size="xs"
                      aria-label={`Restore 1 ${dieType} hit die`}
                      onClick={() => onRestoreHitDice(dieType, 1)}
                    >
                      Restore 1
                    </Button>
                    <Button
                      size="xs"
                      aria-label={`Restore all ${dieType} hit dice`}
                      onClick={() => onRestoreHitDice(dieType, pool.used)}
                    >
                      Restore all
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
