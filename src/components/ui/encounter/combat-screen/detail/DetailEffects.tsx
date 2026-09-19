'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { ActiveEffectChip } from './ActiveEffectChip';
import { CreatureConditionsRow } from './CreatureConditionsRow';
import {
  buildEffectPalette,
  useConditionLibrary,
  useCreatureConditions,
  type PaletteTab,
} from './DetailEffects.hooks';
import { getConditionIcon } from '@/utils/conditionIcons';
import { toAppliedCondition } from '@/utils/customConditions';
import type { DetailSectionProps } from './DetailHeader';
import type { EffectPaletteEntry } from '../effectPalettes';

const PALETTE_TABS: PaletteTab[] = ['conditions', 'buffs'];

function paletteChipClass(tab: PaletteTab, isActive: boolean): string {
  if (tab === 'conditions') {
    return isActive
      ? 'bg-accent-red-bg text-accent-red-text cursor-not-allowed opacity-60'
      : 'bg-surface-raised text-muted hover:bg-accent-red-bg hover:text-accent-red-text shadow-sm';
  }
  return isActive
    ? 'bg-accent-emerald-bg text-accent-emerald-text cursor-not-allowed opacity-60'
    : 'bg-surface-raised text-muted hover:bg-accent-emerald-bg hover:text-accent-emerald-text shadow-sm';
}

export function DetailEffects({ entity, actions }: DetailSectionProps) {
  const [tab, setTab] = useState<PaletteTab>('conditions');
  const [customInput, setCustomInput] = useState('');
  const library = useConditionLibrary();
  const creatureConditions = useCreatureConditions(entity.id, library);

  const activeNames = new Set(entity.conditions.map(c => c.name));
  const palette = buildEffectPalette(tab, library);

  const handleAddCustom = () => {
    const name = customInput.trim();
    if (!name) return;
    actions.onAddCondition(entity.id, { name, kind: 'neutral', source: 'dm' });
    setCustomInput('');
  };

  const handleApplyPalette = (entry: EffectPaletteEntry) => {
    actions.onAddCondition(
      entity.id,
      entry.condition
        ? toAppliedCondition(entry.condition)
        : { name: entry.name, kind: entry.kind, source: 'dm' }
    );
  };

  return (
    <div className="border-divider space-y-3 border-t p-4">
      <h3 className="text-heading text-xs font-semibold tracking-wider uppercase">
        Active Effects
      </h3>

      {entity.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entity.conditions.map(cond => (
            <ActiveEffectChip
              key={cond.id}
              cond={cond}
              entityId={entity.id}
              actions={actions}
            />
          ))}
        </div>
      )}

      <CreatureConditionsRow
        items={creatureConditions}
        activeNames={activeNames}
        onApply={item =>
          actions.onAddCondition(
            entity.id,
            toAppliedCondition(item.condition, item.sourceName)
          )
        }
      />

      {/* Segmented palette tab */}
      <div className="bg-surface-secondary flex items-center rounded-lg p-0.5">
        {PALETTE_TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors ${
              tab === t
                ? 'bg-surface-raised text-heading shadow-sm'
                : 'text-muted hover:text-body'
            }`}
          >
            {t === 'conditions' ? 'Conditions' : 'Buffs'}
          </button>
        ))}
      </div>

      {/* Palette chips */}
      <div className="flex flex-wrap gap-1">
        {palette.map(entry => {
          const isActive = activeNames.has(entry.name);
          const Icon = entry.condition
            ? getConditionIcon(entry.name, entry.kind, entry.condition.icon)
            : null;
          return (
            <button
              key={entry.condition?.id ?? entry.name}
              disabled={isActive}
              title={entry.condition?.description || undefined}
              onClick={() => handleApplyPalette(entry)}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${paletteChipClass(tab, isActive)}`}
            >
              {Icon && <Icon size={11} aria-hidden />}
              {entry.name}
            </button>
          );
        })}
      </div>

      {/* Custom add */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleAddCustom();
          }}
          placeholder="Custom effect…"
          className="bg-surface-raised text-body placeholder:text-faint flex-1 rounded px-2 py-1 text-xs"
        />
        <button
          onClick={handleAddCustom}
          disabled={!customInput.trim()}
          className="bg-surface-inset text-muted hover:bg-surface-hover disabled:text-faint flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed"
        >
          <Plus size={11} />
          Add
        </button>
      </div>
    </div>
  );
}
