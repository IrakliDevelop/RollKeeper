'use client';

import React from 'react';

import { NumberField } from '@/components/ui/forms/NumberInput';
import { effectiveAc } from '@/utils/calculations';
import {
  HEADING_CLASS,
  SECTION_CLASS,
} from '@/components/ui/campaign/player-vtt/SheetDrawer/sheetSectionStyles';

import type { CreatureVitalsProps } from './CreatureDrawer.utils';

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function StatTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-secondary rounded-lg p-2.5">
      <p className="text-faint text-[10px] font-bold uppercase">{label}</p>
      {children}
    </div>
  );
}

/** 2x2 grid of AC / Init / Speed / PB·PP tiles, editable inline in editing mode. */
export function CreatureStatTiles({
  entity,
  actions,
  editing,
}: CreatureVitalsProps) {
  const sb = entity.monsterStatBlock;
  const tempAc = entity.tempAc ?? 0;

  const updateSpeed = (value: string) => {
    if (!sb) return;
    actions.onUpdate(entity.id, {
      monsterStatBlock: { ...sb, speed: value },
    });
  };

  return (
    <div className={SECTION_CLASS}>
      <p className={HEADING_CLASS}>Stats</p>
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="AC">
          {editing ? (
            <div className="flex items-center gap-1">
              <NumberField
                value={entity.armorClass}
                onChange={v =>
                  actions.onUpdate(entity.id, { armorClass: v ?? 0 })
                }
                min={0}
                className="bg-surface-raised text-heading w-12 rounded px-1 py-0.5 text-center text-sm font-bold shadow-sm"
                aria-label="Armor class"
              />
              <span className="text-faint text-xs">+</span>
              <NumberField
                value={entity.tempAc}
                onChange={v =>
                  actions.onUpdate(entity.id, {
                    tempAc: v && v > 0 ? v : undefined,
                  })
                }
                min={0}
                allowEmpty
                className="bg-surface-raised text-accent-blue-text w-10 rounded px-1 py-0.5 text-center text-sm font-medium shadow-sm"
                aria-label="Temporary AC bonus"
              />
            </div>
          ) : (
            <>
              <p className="text-heading text-xl font-bold tabular-nums">
                {effectiveAc(entity.armorClass, entity.tempAc)}
              </p>
              {tempAc > 0 && (
                <p className="text-faint text-[11px]">
                  {entity.armorClass} + {tempAc}
                </p>
              )}
            </>
          )}
        </StatTile>

        <StatTile label="Init">
          {editing ? (
            <NumberField
              value={entity.initiativeModifier}
              onChange={v => {
                if (v !== undefined)
                  actions.onUpdate(entity.id, { initiativeModifier: v });
              }}
              className="bg-surface-raised text-heading w-14 rounded px-1 py-0.5 text-center text-sm font-bold shadow-sm"
              aria-label="Initiative Mod"
            />
          ) : (
            <>
              <p className="text-heading text-xl font-bold tabular-nums">
                {entity.initiative ?? '—'}
              </p>
              <p className="text-faint text-[11px]">
                INIT {signed(entity.initiativeModifier)}
              </p>
            </>
          )}
        </StatTile>

        <StatTile label="Speed">
          {editing && sb ? (
            <input
              type="text"
              defaultValue={sb.speed ?? ''}
              onBlur={e => updateSpeed(e.target.value)}
              className="bg-surface-raised border-divider text-body w-full rounded border px-2 py-0.5 text-xs"
              aria-label="Speed"
            />
          ) : (
            <p className="text-heading text-sm font-semibold">
              {sb?.speed || '—'}
            </p>
          )}
        </StatTile>

        <StatTile label="PB · PP">
          {editing ? (
            <div className="flex items-center gap-1">
              <NumberField
                value={entity.proficiencyBonus}
                onChange={v => {
                  if (v !== undefined)
                    actions.onUpdate(entity.id, { proficiencyBonus: v });
                }}
                allowEmpty
                className="bg-surface-raised text-heading w-12 rounded px-1 py-0.5 text-center text-sm font-bold shadow-sm"
                aria-label="Proficiency Bonus"
              />
              {sb?.passivePerception != null && (
                <span className="text-faint text-xs">
                  · {sb.passivePerception}
                </span>
              )}
            </div>
          ) : (
            <p className="text-heading text-xl font-bold tabular-nums">
              {signed(entity.proficiencyBonus ?? 2)}
              {sb?.passivePerception != null && (
                <span className="text-faint ml-1 text-xs font-normal">
                  · PP {sb.passivePerception}
                </span>
              )}
            </p>
          )}
        </StatTile>
      </div>
    </div>
  );
}
