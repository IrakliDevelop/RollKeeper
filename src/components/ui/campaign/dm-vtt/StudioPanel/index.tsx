'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronRight, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { AppIcon, type IconName } from '@/components/ui/icons';
import { Tooltip } from '@/components/ui/primitives/Tooltip';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { CombatantDetail } from '@/components/ui/encounter/combat-screen/detail/CombatantDetail';
import { focusWasLost } from '@/components/ui/campaign/location-map/useRestoreLostFocus';

import { InitiativeTab } from './InitiativeTab';
import { TokenSettings } from './TokenSettings';

import { cn } from '@/utils/cn';

import type { Encounter, EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

export interface StudioPanelProps {
  encounter: Encounter | null; // the followed encounter (Task 6 resolves it)
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
  actions: EntityActions; // built by Task 8 via buildEntityActions
  activeTab: 'initiative' | 'selected';
  onTabChange: (tab: 'initiative' | 'selected') => void;
  encounterHref: string; // "Encounter page" link, opens in a new tab
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
 * An overlay surface docked to the right edge; its Tooltips need the
 * `TooltipProvider` that `DmVttScreen` wraps around the floating panels.
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
}: StudioPanelProps) {
  const pillRef = useRef<HTMLButtonElement>(null);
  const collapseRef = useRef<HTMLButtonElement>(null);
  const prevCollapsed = useRef(collapsed);

  // The pill and the collapse button each unmount on click, which drops
  // focus to <body>; hand it to the control that replaced them.
  useEffect(() => {
    if (prevCollapsed.current === collapsed) return;
    prevCollapsed.current = collapsed;
    if (focusWasLost()) (collapsed ? pillRef : collapseRef).current?.focus();
  }, [collapsed]);

  if (collapsed) {
    return (
      <Button
        ref={pillRef}
        variant="secondary"
        size="sm"
        aria-expanded={false}
        onClick={onToggleCollapsed}
        className={cn(
          OVERLAY_SURFACE,
          'pointer-events-auto fixed top-[var(--dm-vtt-panel-top,8rem)] right-0 rounded-r-none border-r-0'
        )}
      >
        Combat
      </Button>
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
      className={cn(
        OVERLAY_SURFACE,
        'pointer-events-auto fixed top-[var(--dm-vtt-panel-top,8rem)] right-0 flex w-[min(390px,40vw)] flex-col overflow-hidden rounded-r-none border-r-0',
        activeTab === 'initiative'
          ? 'max-h-[70vh]'
          : 'max-h-[calc(100vh-var(--dm-vtt-panel-top,8rem)-0.75rem)]'
      )}
      style={{ maxHeight: maxPanelHeight }}
      data-testid="dm-vtt-studio-panel"
      data-active-tab={activeTab}
    >
      <div className="border-divider flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b px-2 py-1.5">
        <div className="flex items-center gap-1">
          {TABS.map(({ key, icon, label }) => (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              selected={activeTab === key}
              aria-pressed={activeTab === key}
              leftIcon={<AppIcon name={icon} className="size-4" />}
              onClick={() => onTabChange(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            asChild
            variant="link"
            size="sm"
            className="hidden px-1 whitespace-nowrap lg:inline-flex"
            rightIcon={<ExternalLink size={14} />}
          >
            <Link
              href={encounterHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              Encounter page
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>
          </Button>
          <Tooltip content="Collapse combat panel">
            <Button
              ref={collapseRef}
              variant="ghost"
              size="sm"
              aria-expanded={true}
              aria-label="Collapse combat panel"
              onClick={onToggleCollapsed}
              className="w-9 shrink-0 px-0"
            >
              <ChevronRight size={16} aria-hidden />
            </Button>
          </Tooltip>
        </div>
      </div>
      {followNote && (
        <p className="type-small text-muted border-divider border-b px-3 py-1">
          {followNote}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === 'initiative' ? (
          <InitiativeTab
            encounter={encounter}
            selectedEntityId={selectedEntityId}
            onSelectEntity={onSelectEntity}
            encounterHref={encounterHref}
          />
        ) : selectedEntity ? (
          <>
            <CombatantDetail
              entity={selectedEntity}
              actions={actions}
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
          <p className="type-small text-muted px-3 py-4">
            Select a combatant or token.
          </p>
        )}
      </div>
    </div>
  );
}
