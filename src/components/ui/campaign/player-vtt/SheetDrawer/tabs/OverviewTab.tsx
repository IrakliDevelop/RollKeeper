'use client';

import { useMemo } from 'react';
import { Star } from 'lucide-react';

import type { ToastData } from '@/components/ui/feedback/Toast';
import { Button } from '@/components/ui/forms/button';
import { useCharacterStore } from '@/store/characterStore';
import { cn } from '@/utils/cn';

import {
  buildHitDice,
  buildPassives,
  buildSlotSummary,
} from '../SheetDrawer.utils';
import { SheetResources } from '../SheetResources';
import { HEADING_CLASS, SECTION_CLASS } from '../sheetSectionStyles';

export interface OverviewTabProps {
  addToast: (t: Omit<ToastData, 'id'>) => void;
}

export function OverviewTab({ addToast }: OverviewTabProps) {
  const character = useCharacterStore(s => s.character);
  const spendHitDie = useCharacterStore(s => s.useHitDie);
  const addHeroicInspiration = useCharacterStore(s => s.addHeroicInspiration);
  const spendHeroicInspiration = useCharacterStore(s => s.useHeroicInspiration);

  const hitDice = useMemo(() => buildHitDice(character), [character]);
  const slotSummary = useMemo(() => buildSlotSummary(character), [character]);
  const passives = useMemo(() => buildPassives(character), [character]);
  const inspired = (character.heroicInspiration?.count ?? 0) > 0;

  return (
    <div className="space-y-3">
      <SheetResources />

      {hitDice.length > 0 && (
        <div className={SECTION_CLASS}>
          <h3 className={HEADING_CLASS}>Hit Dice</h3>
          <div className="space-y-2">
            {hitDice.map(d => (
              <div key={d.dieType} className="flex items-center gap-2">
                <span className="text-heading w-10 shrink-0 text-sm font-semibold uppercase">
                  {d.dieType}
                </span>
                <div className="flex flex-1 flex-wrap gap-1">
                  {Array.from({ length: d.max }, (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        'h-2.5 w-2.5 rounded-full border',
                        index < d.remaining
                          ? 'bg-accent-emerald-text-muted border-accent-emerald-border'
                          : 'border-divider'
                      )}
                    />
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={d.remaining === 0}
                  aria-label={`Spend ${d.dieType}`}
                  onClick={() => {
                    spendHitDie(d.dieType, 1);
                    addToast({
                      type: 'info',
                      title: `Spent a ${d.dieType}`,
                      message: `${d.remaining - 1} left`,
                    });
                  }}
                >
                  Spend
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {slotSummary.length > 0 && (
        <div className={SECTION_CLASS}>
          <h3 className={HEADING_CLASS}>Spell Slots</h3>
          <div className="flex flex-wrap gap-3">
            {slotSummary.map(slot => (
              <div key={slot.label} className="flex items-center gap-1.5">
                <span className="text-muted text-xs font-semibold">
                  {slot.label}
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: slot.max }, (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        'h-2.5 w-2.5 rounded-full border',
                        index < slot.remaining
                          ? 'bg-accent-blue-text-muted border-accent-blue-border'
                          : 'border-divider'
                      )}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={SECTION_CLASS}>
        <button
          type="button"
          aria-label="Heroic inspiration"
          aria-pressed={inspired}
          onClick={() =>
            inspired ? spendHeroicInspiration() : addHeroicInspiration(1)
          }
          className="flex w-full items-center justify-between"
        >
          <span className={HEADING_CLASS + ' mb-0'}>Heroic Inspiration</span>
          <span
            className={cn(
              'flex items-center gap-1 text-sm font-semibold',
              inspired ? 'text-accent-amber-text' : 'text-muted'
            )}
          >
            <Star className={cn('h-3.5 w-3.5', inspired && 'fill-current')} />
            {inspired ? 'Ready' : 'None'}
          </span>
        </button>
      </div>

      <div className={SECTION_CLASS}>
        <h3 className={HEADING_CLASS}>Senses & Passives</h3>
        <div className="flex flex-wrap gap-2">
          {passives.map(p => (
            <span
              key={p.label}
              className="border-divider text-muted rounded-full border px-2 py-0.5 text-xs"
            >
              {p.label}{' '}
              <span className="text-heading font-semibold">{p.value}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
