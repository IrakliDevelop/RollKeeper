'use client';

import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Activity, Castle, LockOpen, ScrollText, Swords } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { useStatBlockEditDialog } from '@/components/ui/encounter/combat-screen/detail/StatBlockEditDialog';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';
import type { EncounterEntity } from '@/types/encounter';

import { CreatureAbilities } from './CreatureAbilities';
import { CreatureHeader } from './CreatureHeader';
import { CreatureHpCard } from './CreatureHpCard';
import { CreaturePlayersRow } from './CreaturePlayersRow';
import { CreatureStatTiles } from './CreatureStatTiles';
import { CreatureStatusRow } from './CreatureStatusRow';
import {
  CreatureTabBar,
  type CreatureTabDefinition,
  type CreatureTabId,
} from './CreatureTabBar';
import { ActionsTab } from './tabs/ActionsTab';
import { EffectsTab } from './tabs/EffectsTab';
import { LairTab } from './tabs/LairTab';
import { StatBlockTab, type StatBlockTabProps } from './tabs/StatBlockTab';

const LAIR_TABS: CreatureTabDefinition[] = [
  { id: 'lair', label: 'Lair', icon: Castle },
];

const TAB_CONTENT_CLASS = 'px-5 py-4';

export interface CreatureSheetProps {
  entity: EncounterEntity;
  actions: EntityActions;
  isTurn: boolean;
  onClose: () => void;
  onTokenIdentityChange?: StatBlockTabProps['onTokenIdentityChange'];
}

/**
 * Drawer body: pinned header + players row, then a scrolling area with the
 * vitals, abilities, tab bar, editing banner, and tab content. Owns the
 * Play/Editing lock, the active tab, and the single stat block editor dialog.
 * Lair entities get the reduced layout (header, players row, and a single
 * Lair tab).
 */
export function CreatureSheet({
  entity,
  actions,
  isTurn,
  onClose,
  onTokenIdentityChange,
}: CreatureSheetProps) {
  const isLair = entity.type === 'lair';
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<CreatureTabId>(
    isLair ? 'lair' : 'actions'
  );
  const editor = useStatBlockEditDialog(entity, actions);
  const openEditor = editor.canEdit ? editor.open : undefined;

  const tabs: CreatureTabDefinition[] = isLair
    ? LAIR_TABS
    : [
        { id: 'actions', label: 'Actions', icon: Swords },
        { id: 'statblock', label: 'Stat block', icon: ScrollText },
        {
          id: 'effects',
          label: 'Effects',
          icon: Activity,
          count: entity.conditions.length,
        },
      ];
  const tabProps = { entity, actions, editing };

  return (
    <div className="flex h-full flex-col">
      <div className="border-divider shrink-0 border-b">
        <CreatureHeader
          entity={entity}
          actions={actions}
          isTurn={isTurn}
          editing={editing}
          onToggleEditing={() => setEditing(e => !e)}
          onClose={onClose}
        />
        <div className="px-4 pb-3">
          <CreaturePlayersRow entity={entity} actions={actions} />
        </div>
      </div>

      <Tabs.Root
        value={activeTab}
        onValueChange={v => setActiveTab(v as CreatureTabId)}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {!isLair && (
          <div className="space-y-3 px-5 py-4">
            <CreatureHpCard {...tabProps} />
            <CreatureStatTiles {...tabProps} />
            <CreatureStatusRow {...tabProps} />
            <CreatureAbilities {...tabProps} />
          </div>
        )}

        <CreatureTabBar tabs={tabs} activeTab={activeTab} />

        {editing && (
          <div className="bg-accent-amber-bg border-accent-amber-border text-accent-amber-text flex flex-wrap items-center gap-2 border-b px-5 py-2 text-xs">
            <LockOpen className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">
              Editing this combatant. Changes stay on this combatant.
            </span>
            {openEditor && (
              <Button variant="outline" size="sm" onClick={openEditor}>
                Full stat block editor
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Done
            </Button>
          </div>
        )}

        {isLair ? (
          <Tabs.Content value="lair" className={TAB_CONTENT_CLASS}>
            <LairTab
              {...tabProps}
              onTokenIdentityChange={onTokenIdentityChange}
            />
          </Tabs.Content>
        ) : (
          <>
            <Tabs.Content value="actions" className={TAB_CONTENT_CLASS}>
              <ActionsTab {...tabProps} />
            </Tabs.Content>
            <Tabs.Content value="statblock" className={TAB_CONTENT_CLASS}>
              <StatBlockTab
                {...tabProps}
                onOpenEditor={openEditor}
                onTokenIdentityChange={onTokenIdentityChange}
              />
            </Tabs.Content>
            <Tabs.Content value="effects" className={TAB_CONTENT_CLASS}>
              <EffectsTab {...tabProps} />
            </Tabs.Content>
          </>
        )}
      </Tabs.Root>

      {editor.dialog}
    </div>
  );
}
