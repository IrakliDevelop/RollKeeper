'use client';

import React from 'react';

import { Button } from '@/components/ui/forms/button';
import { DetailCombatInfo } from '@/components/ui/encounter/combat-screen/detail/DetailCombatInfo';
import { TokenSettings } from '@/components/ui/campaign/dm-vtt/StudioPanel/TokenSettings';
import {
  HEADING_CLASS,
  SECTION_CLASS,
} from '@/components/ui/campaign/player-vtt/SheetDrawer/sheetSectionStyles';
import type { EncounterEntity } from '@/types/encounter';

import type { CreatureTabProps } from '../CreatureDrawer.utils';

export interface StatBlockTabProps extends CreatureTabProps {
  /** Opens the full stat block editor dialog; undefined when this entity can't be edited (the caller owns the dialog). */
  onOpenEditor?: () => void;
  onTokenIdentityChange?: (
    updates: Pick<
      EncounterEntity,
      'avatarUrl' | 'tokenSize' | 'chessPiece' | 'color'
    >
  ) => void;
}

function sourceLabel(entity: EncounterEntity): string {
  if (entity.npcSourceId) return 'NPC library';
  if (entity.monsterSourceId) return 'Bestiary';
  return 'Custom';
}

/** Stat block tab: combat details, source, the full editor entry point, and token appearance. */
export function StatBlockTab({
  entity,
  actions,
  editing,
  onOpenEditor,
  onTokenIdentityChange,
}: StatBlockTabProps) {
  return (
    <div className="space-y-3">
      <DetailCombatInfo entity={entity} actions={actions} readOnly={!editing} />
      <div className={SECTION_CLASS}>
        <h3 className={HEADING_CLASS}>Source</h3>
        <p className="text-body text-sm">{sourceLabel(entity)}</p>
        {onOpenEditor && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={onOpenEditor}
          >
            Full stat block editor
          </Button>
        )}
      </div>
      {onTokenIdentityChange && (
        <TokenSettings entity={entity} onChange={onTokenIdentityChange} />
      )}
    </div>
  );
}
