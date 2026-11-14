'use client';

import React from 'react';

import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import { DetailCombatInfo } from '@/components/ui/encounter/combat-screen/detail/DetailCombatInfo';
import { TokenSettings } from '@/components/ui/campaign/dm-vtt/StudioPanel/TokenSettings';
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
    <div className="space-y-6">
      <DetailCombatInfo entity={entity} actions={actions} readOnly={!editing} />
      <Section level={4} heading="Source">
        <p className="type-body text-body">{sourceLabel(entity)}</p>
        {onOpenEditor && (
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={onOpenEditor}
          >
            Full stat block editor
          </Button>
        )}
      </Section>
      {onTokenIdentityChange && (
        <TokenSettings entity={entity} onChange={onTokenIdentityChange} />
      )}
    </div>
  );
}
