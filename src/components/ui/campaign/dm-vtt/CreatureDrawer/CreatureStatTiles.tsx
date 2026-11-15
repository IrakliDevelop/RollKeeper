'use client';

import React from 'react';

import { Input } from '@/components/ui/forms/input';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { Section } from '@/components/ui/layout/section';
import { signed } from '@/components/ui/encounter/combat-screen/detail/DetailAbilityScores.utils';
import { effectiveAc } from '@/utils/calculations';

import { useDraftValue } from './useDraftValue';
import type { CreatureVitalsProps } from './CreatureDrawer.utils';

const VALUE_CLASS = 'type-num-lg text-heading tabular-nums';
const SUB_LINE_CLASS = 'type-small text-muted';
const EDITOR_CLASS = 'px-1 text-center tabular-nums';

/** One term of the stats list: its label, then its value and sub-line `dd`s. */
function StatCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="type-small text-muted">{label}</dt>
      {children}
    </div>
  );
}

/** "Stats" section: AC / Init / Speed / PB·PP, editable inline in editing mode. */
export function CreatureStatTiles({
  entity,
  actions,
  editing,
}: CreatureVitalsProps) {
  const sb = entity.monsterStatBlock;
  const tempAc = entity.tempAc ?? 0;

  const [speed, setSpeed] = useDraftValue(sb?.speed ?? '');

  const commitSpeed = () => {
    if (!sb || speed === (sb.speed ?? '')) return;
    actions.onUpdate(entity.id, {
      monsterStatBlock: { ...sb, speed },
    });
  };

  return (
    <Section level={4} heading="Stats">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <StatCell label="AC">
          {editing ? (
            <dd className="flex items-center gap-1">
              <NumberInput
                size="sm"
                value={entity.armorClass}
                onChange={v =>
                  actions.onUpdate(entity.id, { armorClass: v ?? 0 })
                }
                min={0}
                wrapperClassName="w-14"
                className={EDITOR_CLASS}
                aria-label="Armor class"
              />
              <span className="type-small text-muted">+</span>
              <NumberInput
                size="sm"
                value={entity.tempAc}
                onChange={v =>
                  actions.onUpdate(entity.id, {
                    tempAc: v && v > 0 ? v : undefined,
                  })
                }
                min={0}
                allowEmpty
                wrapperClassName="w-12"
                className={EDITOR_CLASS}
                aria-label="Temporary AC bonus"
              />
            </dd>
          ) : (
            <>
              <dd className={VALUE_CLASS}>
                {effectiveAc(entity.armorClass, entity.tempAc)}
              </dd>
              {tempAc > 0 && (
                <dd className={SUB_LINE_CLASS}>
                  {entity.armorClass} + {tempAc}
                </dd>
              )}
            </>
          )}
        </StatCell>

        <StatCell label="Init">
          {editing ? (
            <dd>
              <NumberInput
                size="sm"
                value={entity.initiativeModifier}
                onChange={v => {
                  if (v !== undefined)
                    actions.onUpdate(entity.id, { initiativeModifier: v });
                }}
                wrapperClassName="w-14"
                className={EDITOR_CLASS}
                aria-label="Initiative modifier"
              />
            </dd>
          ) : (
            <>
              <dd className={VALUE_CLASS}>{entity.initiative ?? '—'}</dd>
              <dd className={SUB_LINE_CLASS}>
                Init {signed(entity.initiativeModifier)}
              </dd>
            </>
          )}
        </StatCell>

        <StatCell label="Speed">
          {editing && sb ? (
            <dd>
              <Input
                size="sm"
                value={speed}
                onChange={e => setSpeed(e.target.value)}
                onBlur={commitSpeed}
                aria-label="Speed"
              />
            </dd>
          ) : (
            <dd className="type-ui text-heading">{sb?.speed || '—'}</dd>
          )}
        </StatCell>

        <StatCell label="PB · PP">
          {editing ? (
            <dd className="flex items-center gap-1">
              <NumberInput
                size="sm"
                value={entity.proficiencyBonus}
                onChange={v => {
                  if (v !== undefined)
                    actions.onUpdate(entity.id, { proficiencyBonus: v });
                }}
                allowEmpty
                wrapperClassName="w-14"
                className={EDITOR_CLASS}
                aria-label="Proficiency bonus"
              />
              {sb?.passivePerception != null && (
                <span className={SUB_LINE_CLASS}>· {sb.passivePerception}</span>
              )}
            </dd>
          ) : (
            <dd className={VALUE_CLASS}>
              {signed(entity.proficiencyBonus ?? 2)}
              {sb?.passivePerception != null && (
                <span className={`${SUB_LINE_CLASS} ml-1`}>
                  · PP {sb.passivePerception}
                </span>
              )}
            </dd>
          )}
        </StatCell>
      </dl>
    </Section>
  );
}
