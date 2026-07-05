'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { DetailSectionProps } from './DetailHeader';
import { DEBUFF_PALETTE, BUFF_PALETTE } from '../effectPalettes';
import { ActiveEffectChip } from './ActiveEffectChip';

type PaletteTab = 'conditions' | 'buffs';

export function DetailEffects({ entity, actions }: DetailSectionProps) {
  const [tab, setTab] = useState<PaletteTab>('conditions');
  const [customInput, setCustomInput] = useState('');

  const activeNames = new Set(entity.conditions.map(c => c.name));
  const palette = tab === 'conditions' ? DEBUFF_PALETTE : BUFF_PALETTE;

  const handleAddCustom = () => {
    const name = customInput.trim();
    if (!name) return;
    actions.onAddCondition(entity.id, { name, kind: 'neutral', source: 'dm' });
    setCustomInput('');
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

      {/* Segmented palette tab */}
      <div className="bg-surface-secondary flex items-center rounded-lg p-0.5">
        {(['conditions', 'buffs'] as PaletteTab[]).map(t => (
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
          const chipClass = isActive
            ? tab === 'conditions'
              ? 'bg-accent-red-bg text-accent-red-text cursor-not-allowed opacity-60'
              : 'bg-accent-emerald-bg text-accent-emerald-text cursor-not-allowed opacity-60'
            : tab === 'conditions'
              ? 'bg-surface-raised text-muted hover:bg-accent-red-bg hover:text-accent-red-text shadow-sm'
              : 'bg-surface-raised text-muted hover:bg-accent-emerald-bg hover:text-accent-emerald-text shadow-sm';

          return (
            <button
              key={entry.name}
              disabled={isActive}
              onClick={() =>
                actions.onAddCondition(entity.id, {
                  name: entry.name,
                  kind: entry.kind,
                  source: 'dm',
                })
              }
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${chipClass}`}
            >
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
