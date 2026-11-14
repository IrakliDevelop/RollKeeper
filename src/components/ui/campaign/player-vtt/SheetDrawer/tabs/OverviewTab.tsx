'use client';

import { useMemo } from 'react';
import { Star } from 'lucide-react';

import type { ToastData } from '@/components/ui/feedback/Toast';
import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import { SlotPips } from '@/components/ui/game/SlotPips';
import { useCharacterStore } from '@/store/characterStore';
import { cn } from '@/utils/cn';

import {
  buildHitDice,
  buildPassives,
  buildSlotSummary,
} from '../SheetDrawer.utils';
import { SheetResources } from '../SheetResources';
import type { SheetSpellCastingProps } from '../SheetDrawer.types';
import { OverviewFavorites } from './OverviewFavorites';

export interface OverviewTabProps {
  addToast: (t: Omit<ToastData, 'id'>) => void;
  spellCasting: SheetSpellCastingProps;
}

export function OverviewTab({ addToast, spellCasting }: OverviewTabProps) {
  const character = useCharacterStore(s => s.character);
  const spendHitDie = useCharacterStore(s => s.useHitDie);
  const addHeroicInspiration = useCharacterStore(s => s.addHeroicInspiration);
  const spendHeroicInspiration = useCharacterStore(s => s.useHeroicInspiration);

  const hitDice = useMemo(() => buildHitDice(character), [character]);
  const slotSummary = useMemo(() => buildSlotSummary(character), [character]);
  const passives = useMemo(() => buildPassives(character), [character]);
  const inspired = (character.heroicInspiration?.count ?? 0) > 0;

  return (
    <div className="space-y-6">
      <OverviewFavorites addToast={addToast} spellCasting={spellCasting} />

      <SheetResources />

      {hitDice.length > 0 && (
        <Section heading="Hit dice" level={4}>
          <div className="space-y-2">
            {hitDice.map(d => (
              <div key={d.dieType} className="flex items-center gap-2">
                <span className="type-num-md text-heading w-10 shrink-0">
                  {d.dieType}
                </span>
                <div className="flex flex-1 flex-wrap gap-1">
                  {Array.from({ length: d.max }, (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        'border-divider-strong size-3 rounded-full border',
                        index < d.remaining && 'bg-heading'
                      )}
                    />
                  ))}
                </div>
                <Button
                  variant="secondary"
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
        </Section>
      )}

      {slotSummary.length > 0 && (
        <Section heading="Spell slots" level={4}>
          <div className="flex flex-wrap gap-3">
            {slotSummary.map(slot => (
              <div key={slot.label} className="flex items-center gap-1.5">
                <span className="type-small text-muted">{slot.label}</span>
                <SlotPips
                  total={slot.max}
                  available={slot.remaining}
                  level={slot.level}
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      <Button
        variant="secondary"
        size="sm"
        selected={inspired}
        aria-pressed={inspired}
        leftIcon={
          <Star
            size={16}
            className={cn(inspired && 'fill-current')}
            aria-hidden
          />
        }
        onClick={() =>
          inspired ? spendHeroicInspiration() : addHeroicInspiration(1)
        }
      >
        Heroic inspiration
      </Button>

      <Section heading="Senses & passives" level={4}>
        <dl className="grid grid-cols-3 gap-x-3">
          {passives.map(p => (
            <div key={p.label} className="flex flex-col-reverse">
              <dt className="type-small text-muted">{p.label}</dt>
              <dd className="type-num-lg text-heading tabular-nums">
                {p.value}
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}
