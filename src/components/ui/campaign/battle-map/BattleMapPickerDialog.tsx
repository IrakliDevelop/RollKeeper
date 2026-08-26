'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';

import { modeStorageKey } from '@/components/ui/campaign/dm-vtt/useBattleMapMode';
import { generateBattleMapId, useBattleMapStore } from '@/store/battleMapStore';
import { useDmStore } from '@/store/dmStore';
import { useDmBattleMapSync } from '@/hooks/useDmBattleMapSync';
import { findLinkedBattleMap, planMapLinkSwitch } from '@/utils/battleMapLinks';

import { BattleMapPickerRow } from './BattleMapPickerRow';

interface BattleMapPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignCode: string;
  encounterId: string;
}

/**
 * Pick, switch, unlink, or create the battle map linked to an encounter,
 * then jump straight to it. Same lock as the map editor's
 * EncounterLinkingPanel — this is just the door on the encounter side.
 */
export function BattleMapPickerDialog({
  open,
  onOpenChange,
  campaignCode,
  encounterId,
}: BattleMapPickerDialogProps) {
  const router = useRouter();
  const { getBattleMaps, addBattleMap, linkEncounter, unlinkEncounter } =
    useBattleMapStore();
  const dmId = useDmStore(s => s.dmId);
  const { pushActive } = useDmBattleMapSync(campaignCode, dmId);
  const [newName, setNewName] = useState('');

  const battleMaps = getBattleMaps(campaignCode);
  const current = findLinkedBattleMap(battleMaps, encounterId);

  // `pushLive` moves the campaign's live-map pointer to the chosen map so
  // players following the "join map" banner land on it without a combat
  // restart. Skipped for freshly created blank maps — those open in setup for
  // the DM to build, and pushing one live would strand players on an empty
  // canvas. See useDmBattleMapSync / EncounterView.pushLinkedMapLive.
  function applyAndGo(mapId: string, pushLive = true) {
    const plan = planMapLinkSwitch(current?.id ?? null, mapId);
    if (plan.unlinkFrom)
      unlinkEncounter(campaignCode, plan.unlinkFrom, encounterId);
    if (plan.linkTo) linkEncounter(campaignCode, plan.linkTo, encounterId);
    if (pushLive) {
      const name = battleMaps.find(m => m.id === mapId)?.name;
      void pushActive(mapId, name);
    }
    onOpenChange(false);
    router.push(`/dm/campaign/${campaignCode}/battlemaps/${mapId}`);
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const id = generateBattleMapId();
    const now = new Date().toISOString();
    addBattleMap(campaignCode, {
      id,
      campaignCode,
      name,
      mapImageUrl: '',
      mapImageSize: { w: 0, h: 0 },
      canvasState: '',
      dmOnlyElements: {},
      gridEnabled: false,
      linkedEncounterIds: [],
      createdAt: now,
      updatedAt: now,
    });
    try {
      // Fresh map with a linked encounter would auto-resolve to play mode —
      // a blank canvas in play mode is wrong. Land the DM in setup.
      window.localStorage.setItem(modeStorageKey(id), 'setup');
    } catch {
      // Ignore localStorage errors
    }
    setNewName('');
    applyAndGo(id, false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Battle Map</DialogTitle>
          <DialogDescription>
            Link this encounter to a battle map and jump straight to it.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {battleMaps.length === 0 ? (
            <p className="text-muted text-sm">
              No battle maps in this campaign yet — create one below.
            </p>
          ) : (
            <div className="space-y-2">
              {battleMaps.map(bm => (
                <BattleMapPickerRow
                  key={bm.id}
                  battleMap={bm}
                  isCurrent={bm.id === current?.id}
                  hasCurrent={!!current}
                  onUnlink={() =>
                    unlinkEncounter(campaignCode, bm.id, encounterId)
                  }
                  onOpen={() => applyAndGo(bm.id)}
                />
              ))}
            </div>
          )}
          <div className="border-divider flex items-center gap-2 border-t pt-4">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
              }}
              placeholder="New map name..."
              wrapperClassName="flex-1"
              aria-label="New battle map name"
            />
            <Button
              variant="primary"
              size="md"
              onClick={handleCreate}
              disabled={!newName.trim()}
              leftIcon={<Plus size={16} />}
            >
              Create & open
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
