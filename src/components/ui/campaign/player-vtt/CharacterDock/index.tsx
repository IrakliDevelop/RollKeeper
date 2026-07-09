'use client';

import { ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import type { ToastData } from '@/components/ui/feedback/Toast';
import { useCharacterStore } from '@/store/characterStore';
import type { SpellAoe } from '@/types/spellAoe';

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
}

/**
 * Right-edge player VTT panel: avatar/name header + `DockVitals` (HP editor,
 * AC/Init, heroic inspiration) + `DockSpells` (search, cast flow, slot pips).
 */
export function CharacterDock({
  collapsed,
  onToggleCollapsed,
  addToast,
  onCastPlacement,
  connectionLive,
  hasPendingPlacement,
  onCancelPlacement,
}: CharacterDockProps) {
  const character = useCharacterStore(state => state.character);

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapsed}
        title="Expand character dock"
        className="bg-surface-raised border-divider pointer-events-auto fixed top-[78px] right-4 flex min-h-[44px] w-11 items-center justify-center rounded-2xl border py-4 text-xs font-bold tracking-wider shadow-xl"
        style={{ writingMode: 'vertical-rl' }}
      >
        CHARACTER
      </button>
    );
  }

  const level = character.totalLevel || character.level;
  const className = character.class?.name || 'Unknown Class';
  const initial = character.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="bg-surface-raised border-divider pointer-events-auto fixed top-[78px] right-4 bottom-6 flex w-[338px] flex-col overflow-hidden rounded-2xl border shadow-xl">
      <div className="border-divider flex shrink-0 items-center gap-3 border-b px-3 py-2.5">
        {character.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={character.avatar}
            alt={character.name}
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="bg-surface-secondary text-heading flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-heading truncate text-sm font-semibold">
            {character.name}
          </div>
          <div className="text-faint truncate text-xs">
            {character.race} · {className} {level}
          </div>
        </div>
        <Button
          variant="ghost"
          size="lg"
          onClick={onToggleCollapsed}
          aria-label="Collapse character dock"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <DockVitals addToast={addToast} />

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
