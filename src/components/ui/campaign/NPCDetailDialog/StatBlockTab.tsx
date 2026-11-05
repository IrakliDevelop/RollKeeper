'use client';

import { HpReadout } from '@/components/ui/campaign/HpReadout';
import { Badge } from '@/components/ui/layout/badge';
import { Button } from '@/components/ui/forms/button';
import { MonsterStatBlockPanel } from '@/components/ui/encounter/MonsterStatBlockPanel';
import { NpcResourceList } from '@/components/ui/encounter/combat-screen/detail/NpcResourceList';
import {
  creaturePassives,
  creatureVitalParts,
} from '../NpcLibrary/NpcLibrary.utils';
import { formatMod } from '../PlayerDetailDialog/shared';
import { useNPCStore } from '@/store/npcStore';
import type { CampaignNPC, StatBlockEntry } from '@/types/encounter';

const ABILITIES = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
] as const;

function getInitiativeModifier(npc: CampaignNPC): number {
  if (npc.initiativeModifier !== undefined) return npc.initiativeModifier;
  const dex = npc.monsterStatBlock?.dex ?? npc.abilityScores?.dex ?? 10;
  return Math.floor((dex - 10) / 2);
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="type-ui flex gap-1">
      <dt className="text-muted">{label}</dt>
      <dd className="text-heading tabular-nums">{value}</dd>
    </div>
  );
}

function extraPairs(npc: CampaignNPC): Array<{ label: string; value: string }> {
  const pairs: Array<{ label: string; value: string }> = [];
  if (npc.xp !== undefined) {
    pairs.push({ label: 'XP', value: npc.xp.toLocaleString() });
  }
  if (npc.proficiencyBonus !== undefined) {
    pairs.push({
      label: 'Proficiency bonus',
      value: formatMod(npc.proficiencyBonus),
    });
  }
  if (npc.hitDice !== undefined) {
    pairs.push({
      label: 'Hit dice',
      value: `${npc.hitDice.current} of ${npc.hitDice.max} (${npc.hitDice.dieType})`,
    });
  }
  for (const { label, value } of creaturePassives(npc)) {
    pairs.push({ label: `Passive ${label}`, value: String(value) });
  }
  return pairs;
}

interface StatBlockTabProps {
  npc: CampaignNPC;
  readOnly?: boolean;
}

export function StatBlockTab({ npc, readOnly }: StatBlockTabProps) {
  const statBlock = npc.monsterStatBlock;
  const extras = extraPairs(npc);
  // A repeated tag would print twice, so show each once.
  const tags = [...new Set(npc.tags ?? [])];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_1fr]">
        <HpReadout
          current={npc.currentHp ?? npc.maxHp}
          max={npc.maxHp}
          temp={npc.tempHp ?? 0}
          size="md"
        />
        <dl className="flex flex-wrap content-start gap-x-4 gap-y-1">
          {creatureVitalParts(npc).map(({ label, value }) => (
            <Pair key={label} label={label} value={value} />
          ))}
          <Pair
            label="Initiative"
            value={formatMod(getInitiativeModifier(npc))}
          />
        </dl>
      </div>

      {extras.length > 0 && (
        <dl className="flex flex-wrap content-start gap-x-4 gap-y-1">
          {extras.map(({ label, value }) => (
            <Pair key={label} label={label} value={value} />
          ))}
        </dl>
      )}

      {tags.length > 0 && (
        <ul aria-label="Tags" className="flex flex-wrap gap-1">
          {tags.map(tag => (
            <li key={tag}>
              <Badge variant="neutral" size="sm">
                {tag}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() =>
              useNPCStore.getState().shortRestNPC(npc.campaignCode, npc.id)
            }
          >
            Take a short rest
          </Button>
          <Button
            size="sm"
            onClick={() =>
              useNPCStore.getState().longRestNPC(npc.campaignCode, npc.id)
            }
          >
            Take a long rest
          </Button>
        </div>
      )}

      {npc.resources && npc.resources.length > 0 && (
        <NpcResourceList
          resources={npc.resources}
          readOnly={readOnly}
          onSpend={(resourceId, amount) =>
            useNPCStore
              .getState()
              .spendNpcResource(npc.campaignCode, npc.id, resourceId, amount)
          }
          onRestore={(resourceId, amount) =>
            useNPCStore
              .getState()
              .restoreNpcResource(npc.campaignCode, npc.id, resourceId, amount)
          }
        />
      )}

      {statBlock ? (
        <MonsterStatBlockPanel
          statBlock={statBlock}
          resources={npc.resources}
          inventory={npc.inventory}
          abilityUsage={npc.abilityUsage}
          readOnly={readOnly}
          onUseEntry={
            readOnly
              ? undefined
              : (entry: StatBlockEntry) => {
                  if (entry.inventoryCost && entry.id) {
                    useNPCStore
                      .getState()
                      .useNpcAbility(npc.campaignCode, npc.id, entry.id);
                  } else if (entry.resourceCost) {
                    useNPCStore
                      .getState()
                      .spendNpcResource(
                        npc.campaignCode,
                        npc.id,
                        entry.resourceCost.resourceId,
                        entry.resourceCost.amount
                      );
                  }
                }
          }
          onUseAbilityEntry={
            readOnly
              ? undefined
              : entry => {
                  if (entry.id) {
                    useNPCStore
                      .getState()
                      .useNpcAbility(npc.campaignCode, npc.id, entry.id);
                  }
                }
          }
          onRestoreAbilityEntry={
            readOnly
              ? undefined
              : entry => {
                  if (entry.id) {
                    useNPCStore
                      .getState()
                      .restoreNpcAbility(npc.campaignCode, npc.id, entry.id);
                  }
                }
          }
        />
      ) : (
        npc.abilityScores && (
          <dl className="grid grid-cols-6 gap-2 text-center">
            {ABILITIES.map(({ key, label }) => {
              const score = npc.abilityScores![key];
              return (
                <div key={key}>
                  <dt className="type-small text-muted">{label}</dt>
                  <dd>
                    <span className="type-ui text-heading block tabular-nums">
                      {score}
                    </span>
                    <span className="type-small text-muted block tabular-nums">
                      {formatMod(Math.floor((score - 10) / 2))}
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>
        )
      )}
    </div>
  );
}
