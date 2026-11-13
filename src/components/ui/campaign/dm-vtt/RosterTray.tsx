'use client';

import { useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Tooltip } from '@/components/ui/primitives/Tooltip';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { focusWasLost } from '@/components/ui/campaign/location-map/useRestoreLostFocus';

import { RosterRow } from './RosterRow';
import { groupRosterEntities } from './rosterGroups';

import { cn } from '@/utils/cn';

import type { PointerEvent } from 'react';
import type { EncounterEntity } from '@/types/encounter';
import type { RosterGroups } from './rosterGroups';

export interface RosterTrayProps {
  entities: EncounterEntity[];
  placedIndex: Map<string, string[]>;
  armedEntityId: string | null;
  onArmPlacement: (entity: EncounterEntity) => void;
  onSelectEntity: (entityId: string) => void;
  onDragStart: (entity: EncounterEntity, e: PointerEvent) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  hasLinkedEncounter: boolean;
  onViewPlayer?: (playerCharacterId: string) => void;
}

const GROUP_SECTIONS: { key: keyof RosterGroups; label: string }[] = [
  { key: 'players', label: 'Players' },
  { key: 'npcs', label: 'NPCs' },
  { key: 'monsters', label: 'Monsters' },
];

/**
 * Roster tray for the DM VTT studio — lists every linked encounter's
 * entities grouped by type, and forwards tap/drag placement intents up to
 * the canvas. Store-free: everything arrives via props for testability.
 * An overlay surface docked to the left edge; its Tooltips need the
 * `TooltipProvider` that `DmVttScreen` wraps around the floating panels.
 */
export function RosterTray({
  entities,
  placedIndex,
  armedEntityId,
  onArmPlacement,
  onSelectEntity,
  onDragStart,
  collapsed,
  onToggleCollapsed,
  hasLinkedEncounter,
  onViewPlayer,
}: RosterTrayProps) {
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
          'pointer-events-auto fixed top-[var(--dm-vtt-panel-top,8rem)] left-0 rounded-l-none border-l-0'
        )}
      >
        Roster
      </Button>
    );
  }

  const groups = groupRosterEntities(entities);

  return (
    <div
      className={cn(
        OVERLAY_SURFACE,
        'pointer-events-auto fixed top-[var(--dm-vtt-panel-top,8rem)] left-0 flex max-h-[70vh] w-[clamp(150px,16vw,180px)] flex-col overflow-hidden rounded-l-none border-l-0'
      )}
      style={{
        maxHeight:
          'min(70dvh, calc(100dvh - var(--dm-vtt-panel-top, 8rem) - 12rem))',
      }}
      data-testid="dm-vtt-roster-panel"
    >
      <div className="border-divider flex shrink-0 items-center justify-between gap-2 border-b py-1 pr-1 pl-3">
        <h2 className="type-ui text-heading">Roster</h2>
        <Tooltip content="Collapse roster">
          <Button
            ref={collapseRef}
            variant="ghost"
            size="sm"
            aria-expanded={true}
            aria-label="Collapse roster"
            onClick={onToggleCollapsed}
            className="w-9 shrink-0 px-0"
          >
            <ChevronLeft size={16} aria-hidden />
          </Button>
        </Tooltip>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {!hasLinkedEncounter ? (
          <p className="type-small text-muted px-1 py-2">
            Link an encounter in Setup mode
          </p>
        ) : entities.length === 0 ? (
          <p className="type-small text-muted px-1 py-2">
            No combatants in the linked encounter yet
          </p>
        ) : (
          GROUP_SECTIONS.map(({ key, label }) => {
            const list = groups[key];
            if (list.length === 0) return null;
            return (
              <div key={key} className="mb-2">
                <h3 className="type-small text-muted px-1 pb-1">{label}</h3>
                <ul className="space-y-1">
                  {list.map(entity => (
                    <RosterRow
                      key={entity.id}
                      entity={entity}
                      placed={(placedIndex.get(entity.id)?.length ?? 0) > 0}
                      armed={armedEntityId === entity.id}
                      onArmPlacement={onArmPlacement}
                      onSelectEntity={onSelectEntity}
                      onDragStart={onDragStart}
                      onViewPlayer={onViewPlayer}
                    />
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
