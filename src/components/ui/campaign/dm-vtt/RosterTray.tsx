'use client';

import { Button } from '@/components/ui/forms/button';

import { RosterRow } from './RosterRow';
import { groupRosterEntities } from './rosterGroups';

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
}

const GROUP_SECTIONS: { key: keyof RosterGroups; label: string }[] = [
  { key: 'players', label: 'PLAYERS' },
  { key: 'npcs', label: 'NPCS' },
  { key: 'monsters', label: 'MONSTERS' },
];

/**
 * Roster tray for the DM VTT studio — lists every linked encounter's
 * entities grouped by type, and forwards tap/drag placement intents up to
 * the canvas. Store-free: everything arrives via props for testability.
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
}: RosterTrayProps) {
  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapsed}
        title="Expand roster"
        className="bg-surface-raised border-divider text-heading pointer-events-auto fixed top-[78px] left-4 flex min-h-[44px] items-center gap-1.5 rounded-2xl border px-3 text-xs font-bold tracking-wider shadow-xl"
      >
        <span aria-hidden>👥</span> ROSTER
      </button>
    );
  }

  const groups = groupRosterEntities(entities);

  return (
    <div className="bg-surface-raised border-divider pointer-events-auto fixed top-[78px] left-4 flex max-h-[calc(100vh-102px)] w-[180px] flex-col overflow-hidden rounded-2xl border shadow-xl">
      <div className="border-divider flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5">
        <span className="text-heading text-sm font-semibold">👥 Roster</span>
        <Button
          variant="ghost"
          size="lg"
          onClick={onToggleCollapsed}
          aria-label="Collapse roster"
        >
          ▸
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {!hasLinkedEncounter ? (
          <p className="text-muted px-1 py-2 text-xs">
            Link an encounter in Setup mode
          </p>
        ) : (
          GROUP_SECTIONS.map(({ key, label }) => {
            const list = groups[key];
            if (list.length === 0) return null;
            return (
              <div key={key} className="mb-2">
                <div className="text-faint px-1 pb-1 text-[10px] font-bold tracking-wider uppercase">
                  {label}
                </div>
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
