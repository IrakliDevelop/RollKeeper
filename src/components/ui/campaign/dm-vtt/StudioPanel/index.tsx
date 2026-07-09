'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/forms/button';
import { CombatantDetail } from '@/components/ui/encounter/combat-screen/detail/CombatantDetail';

import { InitiativeTab } from './InitiativeTab';

import type { Encounter } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

export interface StudioPanelProps {
  encounter: Encounter | null; // the followed encounter (Task 6 resolves it)
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
  actions: EntityActions; // built by Task 8 via buildEntityActions
  activeTab: 'initiative' | 'selected';
  onTabChange: (tab: 'initiative' | 'selected') => void;
  encounterHref: string; // "Encounter page ↗"
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** "Following: {name}" when 2+ linked encounters are active; else null. */
  followNote?: string | null;
}

const TABS: { key: 'initiative' | 'selected'; icon: string; label: string }[] =
  [
    { key: 'initiative', icon: '⚔', label: 'Initiative' },
    { key: 'selected', icon: '📋', label: 'Selected' },
  ];

/**
 * DM VTT studio panel: right-edge collapsible panel with an Initiative tab
 * (turn order, mirrors the player-facing sort) and a Selected tab that
 * reuses the combat-screen `CombatantDetail` for full entity management.
 */
export function StudioPanel({
  encounter,
  selectedEntityId,
  onSelectEntity,
  actions,
  activeTab,
  onTabChange,
  encounterHref,
  collapsed,
  onToggleCollapsed,
  followNote,
}: StudioPanelProps) {
  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapsed}
        title="Expand combat panel"
        className="bg-surface-raised border-divider text-heading pointer-events-auto fixed top-[78px] right-4 flex min-h-[44px] items-center gap-1.5 rounded-2xl border px-3 text-xs font-bold tracking-wider shadow-xl"
      >
        <span aria-hidden>📋</span> COMBAT
      </button>
    );
  }

  const selectedEntity = encounter?.entities.find(
    e => e.id === selectedEntityId
  );

  return (
    <div className="bg-surface-raised border-divider pointer-events-auto fixed top-[78px] right-4 flex max-h-[calc(100vh-102px)] w-[390px] flex-col overflow-hidden rounded-2xl border shadow-xl">
      <div className="border-divider flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1.5">
        <div className="flex items-center gap-1">
          {TABS.map(({ key, icon, label }) => (
            <Button
              key={key}
              variant={activeTab === key ? 'primary' : 'ghost'}
              onClick={() => onTabChange(key)}
              className="min-h-[44px] text-xs"
              aria-label={label}
            >
              <span aria-hidden>{icon}</span> {label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={encounterHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-blue-text px-1 text-xs font-semibold hover:underline"
          >
            Encounter page ↗
          </Link>
          <Button
            variant="ghost"
            size="lg"
            onClick={onToggleCollapsed}
            aria-label="Collapse combat panel"
          >
            ▸
          </Button>
        </div>
      </div>
      {followNote && (
        <p className="text-faint border-divider border-b px-3 py-1 text-xs">
          {followNote}
        </p>
      )}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'initiative' ? (
          <InitiativeTab
            encounter={encounter}
            selectedEntityId={selectedEntityId}
            onSelectEntity={onSelectEntity}
            encounterHref={encounterHref}
          />
        ) : selectedEntity ? (
          <CombatantDetail entity={selectedEntity} actions={actions} />
        ) : (
          <p className="text-muted px-3 py-4 text-xs">
            Select a combatant or token.
          </p>
        )}
      </div>
    </div>
  );
}
