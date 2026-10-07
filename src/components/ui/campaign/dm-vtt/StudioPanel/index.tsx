'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/forms/button';
import { AppIcon, type IconName } from '@/components/ui/icons';
import { CombatantDetail } from '@/components/ui/encounter/combat-screen/detail/CombatantDetail';

import { InitiativeTab } from './InitiativeTab';
import { TokenSettings } from './TokenSettings';

import type { Encounter, EncounterEntity } from '@/types/encounter';
import type {
  CombatantDetailCapabilities,
  EntityActions,
} from '@/components/ui/encounter/combat-screen/types';

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
  /** Persist portrait/size edits + restamp placed tokens (Selected tab section). */
  onTokenIdentityChange?: (
    entity: EncounterEntity,
    updates: Pick<
      EncounterEntity,
      'avatarUrl' | 'tokenSize' | 'chessPiece' | 'color'
    >
  ) => void;
  /**
   * Table scene runs (all optional; legacy rendering when omitted):
   * replaces the "Encounter page ↗" link (`null` hides it), adds a toolbar
   * under the header, replaces the empty/inactive Initiative messages and
   * restricts the Selected tab's detail controls.
   */
  encounterLink?: ReactNode;
  toolbar?: ReactNode;
  emptyContent?: ReactNode;
  inactiveContent?: ReactNode;
  detailCapabilities?: (
    entity: EncounterEntity
  ) => CombatantDetailCapabilities | undefined;
  /** Initiative rows whose live HP is not loaded yet ("HP —"). */
  hpUnknownEntityIds?: ReadonlySet<string>;
}

const TABS: {
  key: 'initiative' | 'selected';
  icon: IconName;
  label: string;
}[] = [
  { key: 'initiative', icon: 'attack', label: 'Initiative' },
  { key: 'selected', icon: 'character', label: 'Selected' },
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
  onTokenIdentityChange,
  encounterLink,
  toolbar,
  emptyContent,
  inactiveContent,
  detailCapabilities,
  hpUnknownEntityIds,
}: StudioPanelProps) {
  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapsed}
        title="Expand combat panel"
        className="bg-surface-raised border-divider text-heading pointer-events-auto fixed top-[var(--dm-vtt-panel-top,8rem)] right-0 flex min-h-[44px] items-center gap-1.5 rounded-l-2xl border px-3 text-xs font-bold tracking-wider shadow-xl"
      >
        <AppIcon name="attack" className="h-4 w-4" /> COMBAT
      </button>
    );
  }

  const selectedEntity = encounter?.entities.find(
    e => e.id === selectedEntityId
  );
  const maxPanelHeight =
    activeTab === 'initiative'
      ? 'min(70dvh, calc(100dvh - var(--dm-vtt-panel-top, 8rem) - 0.75rem))'
      : 'calc(100dvh - var(--dm-vtt-panel-top, 8rem) - 0.75rem)';

  return (
    <div
      className={`bg-surface-raised border-divider pointer-events-auto fixed top-[var(--dm-vtt-panel-top,8rem)] right-0 flex w-[min(390px,40vw)] flex-col overflow-hidden rounded-l-2xl border shadow-xl ${
        activeTab === 'initiative'
          ? 'max-h-[70vh]'
          : 'max-h-[calc(100vh-var(--dm-vtt-panel-top,8rem)-0.75rem)]'
      }`}
      style={{ maxHeight: maxPanelHeight }}
      data-testid="dm-vtt-studio-panel"
      data-active-tab={activeTab}
    >
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
              <AppIcon name={icon} className="h-4 w-4" /> {label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {encounterLink !== undefined ? (
            encounterLink
          ) : (
            <Link
              href={encounterHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-blue-text hidden px-1 text-xs font-semibold hover:underline lg:block"
            >
              Encounter page ↗
            </Link>
          )}
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
      {toolbar}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === 'initiative' ? (
          <InitiativeTab
            encounter={encounter}
            selectedEntityId={selectedEntityId}
            onSelectEntity={onSelectEntity}
            encounterHref={encounterHref}
            emptyContent={emptyContent}
            inactiveContent={inactiveContent}
            hpUnknownEntityIds={hpUnknownEntityIds}
          />
        ) : selectedEntity ? (
          <>
            <CombatantDetail
              entity={selectedEntity}
              actions={actions}
              capabilities={detailCapabilities?.(selectedEntity)}
              key={`detail-${selectedEntity.id}`}
            />
            {onTokenIdentityChange && (
              <TokenSettings
                key={selectedEntity.id}
                entity={selectedEntity}
                onChange={updates =>
                  onTokenIdentityChange(selectedEntity, updates)
                }
              />
            )}
          </>
        ) : (
          <p className="text-muted px-3 py-4 text-xs">
            Select a combatant or token.
          </p>
        )}
      </div>
    </div>
  );
}
