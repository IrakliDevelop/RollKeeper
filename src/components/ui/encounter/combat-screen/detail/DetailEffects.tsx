'use client';

import React, { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Badge } from '@/components/ui/layout/badge';
import { SubTabs, type SubTabDefinition } from '@/components/ui/layout/SubTabs';
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
import { useOfficialConditions } from '@/hooks/useOfficialConditions';
import { usePaletteSpellEffects } from '@/hooks/usePaletteSpellEffects';
import type { DetailSectionProps } from './DetailHeader';
import type { EffectPaletteEntry } from '../effectPalettes';

export function DetailEffects({ entity, actions }: DetailSectionProps) {
  const tabId = useId();
  const [tab, setTab] = useState<PaletteTab>('conditions');
  const [customInput, setCustomInput] = useState('');
  const library = useConditionLibrary();
  const { conditions: officialConditions, loading: officialConditionsLoading } =
    useOfficialConditions();
  const { effects: spellEffects, loading: spellEffectsLoading } =
    usePaletteSpellEffects();
  const creatureConditions = useCreatureConditions(entity.id, library);

  const activeConditions = entity.conditions ?? [];
  const activeNames = new Set(activeConditions.map(c => c.name));
  const palette = buildEffectPalette(
    tab,
    library,
    officialConditions,
    spellEffects
  );

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
        : {
            name: entry.name,
            kind: entry.kind,
            source: 'dm',
            ...(entry.origin ? { origin: entry.origin } : {}),
            ...(entry.description ? { description: entry.description } : {}),
            ...(entry.rulesSource ? { rulesSource: entry.rulesSource } : {}),
          }
    );
  };

  const paletteContent = (
    <div className="space-y-3">
      <div className="grid gap-2">
        {palette.map(entry => {
          const isActive = activeNames.has(entry.name);
          const isWaitingForRules =
            (entry.origin === 'official' && officialConditionsLoading) ||
            (entry.origin === 'spell' && spellEffectsLoading);
          const Icon = entry.condition
            ? getConditionIcon(entry.name, entry.kind, entry.condition.icon)
            : null;
          const description = entry.condition?.description || entry.description;
          return (
            <div
              key={entry.condition?.id ?? entry.name}
              className="border-divider flex flex-wrap items-center gap-x-2 gap-y-1 border-b pb-2 last:border-b-0"
            >
              {isActive ? (
                <Badge
                  variant={tab === 'buffs' ? 'success' : 'warning'}
                  size="sm"
                >
                  {entry.name} · Active
                </Badge>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  disabled={isWaitingForRules}
                  onClick={() => handleApplyPalette(entry)}
                >
                  {Icon && <Icon size={12} aria-hidden="true" />}
                  {entry.name}
                </Button>
              )}
              {description && (
                <span className="text-muted text-xs">{description}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleAddCustom();
          }}
          placeholder="Custom effect…"
          aria-label="Custom effect name"
          size="sm"
          wrapperClassName="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAddCustom}
          disabled={!customInput.trim()}
        >
          <Plus size={12} aria-hidden="true" />
          Add effect
        </Button>
      </div>
    </div>
  );
  const tabs: SubTabDefinition[] = [
    {
      value: 'conditions',
      id: `${tabId}-combat-effects-conditions`,
      label: 'Conditions',
      content: tab === 'conditions' ? paletteContent : null,
    },
    {
      value: 'buffs',
      id: `${tabId}-combat-effects-buffs`,
      label: 'Buffs',
      content: tab === 'buffs' ? paletteContent : null,
    },
  ];

  return (
    <div className="border-divider space-y-3 border-t p-4">
      <h3 className="type-label-heading text-heading">Active effects</h3>

      {activeConditions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeConditions.map(cond => (
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

      <SubTabs
        tabs={tabs}
        label="Effect palette"
        value={tab}
        onValueChange={value => {
          if (value === 'conditions' || value === 'buffs') setTab(value);
        }}
      />
    </div>
  );
}
