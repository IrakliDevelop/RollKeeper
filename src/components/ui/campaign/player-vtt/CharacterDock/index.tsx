'use client';

import { useEffect, useMemo, useRef } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import type { ToastData } from '@/components/ui/feedback/Toast';
import { Tooltip } from '@/components/ui/primitives/Tooltip';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { focusWasLost } from '@/components/ui/campaign/location-map/useRestoreLostFocus';
import { useCharacterStore } from '@/store/characterStore';
import { getActiveClassResources } from '@/utils/classResources';
import { cn } from '@/utils/cn';
import type { SpellAoe } from '@/types/spellAoe';

import { DockBuffs } from './DockBuffs';
import { DockResources } from './DockResources';
import { DockSpells } from './DockSpells';
import { DockVitals } from './DockVitals';

export interface CharacterDockProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  addToast: (toast: Omit<ToastData, 'id'>) => void;
  onCastPlacement: (spellName: string, aoe: NonNullable<SpellAoe>) => void;
  connectionLive: boolean;
  hasPendingPlacement: boolean;
  onCancelPlacement: () => void;
  onOpenSheet?: () => void;
  /** Attached to the Sheet button so focus can return to it on drawer close. */
  sheetButtonRef?: React.Ref<HTMLButtonElement>;
}

/**
 * Below `xl` the status tray shares the strip under the tool island, so the
 * panel and its pill sit beneath it (`--player-vtt-tray-height`); from `xl`
 * the tray sits beside the panel column. Both variables fall back to today's
 * position, so nothing moves before the map mounts.
 */
const PANEL_TOP =
  'top-[calc(var(--player-vtt-panel-top,78px)+var(--player-vtt-tray-height,0px))] xl:top-[var(--player-vtt-panel-top,78px)]';

/**
 * Right-edge player VTT panel: avatar/name header + `DockVitals` (HP editor,
 * AC/Init, heroic inspiration) + `DockSpells` (search, cast flow, slot pips).
 * An overlay surface; its Tooltip needs the `TooltipProvider` that
 * `PlayerVttScreen` wraps around the floating panels.
 */
export function CharacterDock({
  collapsed,
  onToggleCollapsed,
  addToast,
  onCastPlacement,
  connectionLive,
  hasPendingPlacement,
  onCancelPlacement,
  onOpenSheet,
  sheetButtonRef,
}: CharacterDockProps) {
  const character = useCharacterStore(state => state.character);
  const toggleBuff = useCharacterStore(state => state.toggleBuff);
  const expendClassResource = useCharacterStore(
    state => state.useClassResource
  );
  const restoreClassResource = useCharacterStore(
    state => state.restoreClassResource
  );

  const pillRef = useRef<HTMLButtonElement>(null);
  const collapseRef = useRef<HTMLButtonElement>(null);
  const prevCollapsed = useRef(collapsed);

  const resources = useMemo(
    () => getActiveClassResources(character),
    [character]
  );

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
          'bg-surface-elevated pointer-events-auto fixed right-4',
          PANEL_TOP
        )}
      >
        Character
      </Button>
    );
  }

  const handleToggleBuff = (id: string) => {
    const buff = (character.temporaryBuffs || []).find(b => b.id === id);
    toggleBuff(id);
    if (buff) {
      addToast({
        type: 'info',
        title: `${buff.name} ${buff.isActive ? 'off' : 'on'}`,
        message: '',
      });
    }
  };

  const handleSpendResource = (id: string) => {
    expendClassResource(id, 1);
    const after = getActiveClassResources(
      useCharacterStore.getState().character
    ).find(r => r.definition.id === id);
    if (after) {
      addToast({
        type: 'info',
        title: `${after.definition.name}: ${after.usesRemaining}/${after.maxUses} left`,
        message: '',
      });
    }
  };

  const handleRestoreResource = (id: string) => {
    restoreClassResource(id, 1);
  };

  const level = character.totalLevel || character.level;
  const className = character.class?.name || 'Unknown class';
  const initial = character.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div
      className={cn(
        OVERLAY_SURFACE,
        'pointer-events-auto fixed right-4 bottom-6 flex w-[338px] flex-col overflow-hidden',
        PANEL_TOP
      )}
    >
      <div className="border-divider flex shrink-0 items-center gap-3 border-b px-3 py-2">
        {character.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={character.avatar}
            alt={character.name}
            className="size-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="bg-surface-secondary text-heading type-subheading flex size-10 shrink-0 items-center justify-center rounded-full">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="type-ui text-heading truncate">{character.name}</h2>
          <p className="type-small text-muted truncate">
            {[character.race, `${className} ${level}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {onOpenSheet && (
          <Button
            ref={sheetButtonRef}
            variant="secondary"
            size="sm"
            leftIcon={<BookOpen size={16} aria-hidden />}
            aria-label="Open character sheet"
            onClick={onOpenSheet}
          >
            Sheet
          </Button>
        )}
        <Tooltip content="Collapse character dock">
          <Button
            ref={collapseRef}
            variant="ghost"
            size="sm"
            className="w-9 shrink-0 px-0"
            aria-label="Collapse character dock"
            aria-expanded={true}
            onClick={onToggleCollapsed}
          >
            <ChevronRight size={16} aria-hidden />
          </Button>
        </Tooltip>
      </div>

      <div className="flex-1 space-y-6 overflow-x-hidden overflow-y-auto px-3 py-3">
        <DockVitals addToast={addToast} />

        <DockBuffs
          buffs={character.temporaryBuffs || []}
          onToggleBuff={handleToggleBuff}
        />

        <DockResources
          resources={resources}
          onSpend={handleSpendResource}
          onRestore={handleRestoreResource}
        />

        <DockSpells
          addToast={addToast}
          onCastPlacement={onCastPlacement}
          connectionLive={connectionLive}
          hasPendingPlacement={hasPendingPlacement}
          onCancelPlacement={onCancelPlacement}
        />
      </div>
    </div>
  );
}
