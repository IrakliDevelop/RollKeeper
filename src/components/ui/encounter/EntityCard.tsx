'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Shield,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { EncounterEntity } from '@/types/encounter';
import { HPBar } from '@/components/shared/combat/HPBar';
import { ConditionBadge } from '@/components/shared/combat/ConditionBadge';
import { EntityCardExpanded } from './EntityCardExpanded';

interface EntityCardProps {
  entity: EncounterEntity;
  isCurrentTurn: boolean;
  lastSynced?: string; // ISO timestamp for player sync freshness
  onUpdate: (updates: Partial<EncounterEntity>) => void;
  onRemove: () => void;
  onDamage: (amount: number) => void;
  onHeal: (amount: number) => void;
  onAddCondition: (condition: { name: string; description?: string }) => void;
  onRemoveCondition: (conditionId: string) => void;
  onUseAbility: (abilityId: string) => void;
  onRestoreAbility: (abilityId: string) => void;
  onUseLegendaryAction: (actionId: string) => void;
  onResetLegendaryActions: () => void;
  onSetConcentration: (spellName: string | null) => void;
  onUseLairAction?: (actionId: string) => void;
  onSetInitiative: (value: number) => void;
}

const TYPE_STYLES: Record<
  string,
  { border: string; badge: string; badgeBg: string }
> = {
  player: {
    border: 'border-accent-blue-border',
    badge: 'text-accent-blue-text',
    badgeBg: 'bg-accent-blue-bg',
  },
  npc: {
    border: 'border-accent-purple-border',
    badge: 'text-accent-purple-text',
    badgeBg: 'bg-accent-purple-bg',
  },
  monster: {
    border: 'border-accent-red-border',
    badge: 'text-accent-red-text',
    badgeBg: 'bg-accent-red-bg',
  },
  lair: {
    border: 'border-accent-amber-border',
    badge: 'text-accent-amber-text',
    badgeBg: 'bg-accent-amber-bg',
  },
};

function SyncIndicator({ lastSynced }: { lastSynced?: string }) {
  if (!lastSynced) return null;
  const ago = Date.now() - new Date(lastSynced).getTime();
  const color =
    ago < 30000
      ? 'bg-green-500'
      : ago < 120000
        ? 'bg-yellow-500'
        : 'bg-red-500';
  const label =
    ago < 30000
      ? 'Synced recently'
      : ago < 120000
        ? 'Synced >30s ago'
        : 'Sync stale';
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`}
      title={label}
    />
  );
}

export function EntityCard({
  entity,
  isCurrentTurn,
  lastSynced,
  onUpdate,
  onRemove,
  onDamage,
  onHeal,
  onAddCondition,
  onRemoveCondition,
  onUseAbility,
  onRestoreAbility,
  onUseLegendaryAction,
  onResetLegendaryActions,
  onSetConcentration,
  onUseLairAction,
  onSetInitiative,
}: EntityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingInit, setEditingInit] = useState(false);
  const [initInput, setInitInput] = useState('');
  const style = TYPE_STYLES[entity.type] ?? TYPE_STYLES.monster;
  const isDead = entity.currentHp <= 0 && entity.type !== 'lair';

  return (
    <div
      className={`bg-surface-raised rounded-lg border-2 shadow-sm transition-all ${style.border} ${
        isCurrentTurn
          ? 'ring-accent-amber-border ring-2 ring-offset-1 ring-offset-transparent'
          : ''
      } ${isDead ? 'opacity-60' : ''} ${entity.isHidden ? 'border-dashed' : ''}`}
    >
      {/* Compact view — always visible */}
      <div className="flex items-center gap-3 p-3">
        {/* Initiative */}
        {editingInit ? (
          <input
            type="number"
            value={initInput}
            onChange={e => setInitInput(e.target.value)}
            onBlur={() => {
              const val = parseInt(initInput);
              if (!isNaN(val)) onSetInitiative(val);
              setEditingInit(false);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const val = parseInt(initInput);
                if (!isNaN(val)) onSetInitiative(val);
                setEditingInit(false);
              }
              if (e.key === 'Escape') setEditingInit(false);
            }}
            className="bg-surface-secondary text-heading h-10 w-10 rounded-lg text-center text-sm font-bold"
            autoFocus
          />
        ) : (
          <button
            onClick={() => {
              setInitInput(entity.initiative?.toString() ?? '');
              setEditingInit(true);
            }}
            className="bg-surface-secondary text-heading hover:ring-accent-amber-border flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums transition-all hover:ring-2"
            title="Click to set initiative"
          >
            {entity.initiative ?? '—'}
          </button>
        )}

        {/* Name + HP + Conditions */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className={`text-heading truncate font-semibold ${isDead ? 'line-through' : ''}`}
            >
              {entity.name}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.badgeBg} ${style.badge}`}
            >
              {entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}
            </span>
            {entity.type === 'player' && (
              <SyncIndicator lastSynced={lastSynced} />
            )}
            {entity.concentrationSpell && (
              <span className="bg-accent-orange-bg text-accent-orange-text shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
                <Sparkles size={10} className="mr-0.5 inline" />
                {entity.concentrationSpell}
              </span>
            )}
          </div>

          {/* HP Bar (skip for lair entities) */}
          {entity.type !== 'lair' && (
            <HPBar
              current={entity.currentHp}
              max={entity.maxHp}
              temp={entity.tempHp}
              size="sm"
            />
          )}

          {/* Lair actions quick display */}
          {entity.type === 'lair' && entity.lairActions && (
            <div className="flex gap-1">
              {entity.lairActions.map(la => (
                <span
                  key={la.id}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    la.usedThisRound
                      ? 'bg-surface-secondary text-faint line-through'
                      : 'bg-accent-amber-bg text-accent-amber-text'
                  }`}
                >
                  {la.name}
                </span>
              ))}
            </div>
          )}

          {/* Condition badges */}
          {entity.conditions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {entity.conditions.map(c => (
                <ConditionBadge
                  key={c.id}
                  name={c.name}
                  stackCount={c.stackCount}
                  sourceSpell={c.sourceSpell}
                  onRemove={() => onRemoveCondition(c.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right side: AC + controls */}
        <div className="flex shrink-0 items-center gap-2">
          {entity.type !== 'lair' && (
            <div className="text-muted flex items-center gap-1 text-sm">
              <Shield size={14} />
              <span className="font-medium tabular-nums">
                {entity.armorClass}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1">
            {entity.isHidden !== undefined && (
              <button
                onClick={() => onUpdate({ isHidden: !entity.isHidden })}
                className="text-muted hover:text-body rounded p-1 transition-colors"
                title={entity.isHidden ? 'Show' : 'Hide'}
              >
                {entity.isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-muted hover:text-body rounded p-1 transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded view */}
      {isExpanded && (
        <EntityCardExpanded
          entity={entity}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onDamage={onDamage}
          onHeal={onHeal}
          onAddCondition={onAddCondition}
          onRemoveCondition={onRemoveCondition}
          onUseAbility={onUseAbility}
          onRestoreAbility={onRestoreAbility}
          onUseLegendaryAction={onUseLegendaryAction}
          onResetLegendaryActions={onResetLegendaryActions}
          onSetConcentration={onSetConcentration}
          onUseLairAction={onUseLairAction}
        />
      )}
    </div>
  );
}
