'use client';

import type { CustomCondition } from '@/types/encounter';
import { Input } from '@/components/ui/forms/input';
import { NumberInput, NumberField } from '@/components/ui/forms/NumberInput';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { useEncounterStore } from '@/store/encounterStore';
import { useOfficialConditions } from '@/hooks/useOfficialConditions';
import { EMPTY_CUSTOM_CONDITIONS } from '@/utils/customConditions';
import { AbilityListEditor } from '../AbilityListEditor';
import { NpcResourcesEditor } from '../NpcResourcesEditor';
import { NpcInflictsEditor } from '../NpcInflictsEditor';
import { abilityMod, DIE_TYPES, withPassiveOverride } from './npcFormDraft';
import type {
  AbilityKey,
  NpcDerivedFields,
  NpcFormDraft,
  NpcFormUpdate,
} from './npcFormDraft';

interface StatBlockTabProps {
  draft: NpcFormDraft;
  update: NpcFormUpdate;
  derived: NpcDerivedFields;
  onDeleteResource: (id: string) => void;
}

export function StatBlockTab({
  draft,
  update,
  derived,
  onDeleteResource,
}: StatBlockTabProps) {
  const { conditions: officialConditions, loading: officialConditionsLoading } =
    useOfficialConditions();

  // Condition library
  const conditionLibrary = useEncounterStore(
    state => state.combatConfig.customConditions ?? EMPTY_CUSTOM_CONDITIONS
  );
  const setCombatConfig = useEncounterStore(state => state.setCombatConfig);

  const handleCreateConditionInLibrary = (condition: CustomCondition) => {
    setCombatConfig({ customConditions: [...conditionLibrary, condition] });
  };

  return (
    <>
      {/* ===== Ability Scores ===== */}
      <div>
        <label className="text-heading mb-1.5 block text-sm font-medium">
          Ability Scores
        </label>
        <div className="grid grid-cols-6 gap-2">
          {(
            [
              ['STR', 'str'],
              ['DEX', 'dex'],
              ['CON', 'con'],
              ['INT', 'int'],
              ['WIS', 'wis'],
              ['CHA', 'cha'],
            ] as const satisfies ReadonlyArray<readonly [string, AbilityKey]>
          ).map(([label, key]) => (
            <div key={label} className="text-center">
              <span className="text-muted block text-[10px] font-medium uppercase">
                {label}
              </span>
              <NumberField
                value={draft[key]}
                onChange={v =>
                  update({ [key]: v ?? 0 } as Pick<NpcFormDraft, AbilityKey>)
                }
                min={1}
                max={30}
                className="bg-surface border-divider text-heading w-full rounded border px-1 py-1 text-center text-sm"
              />
              <span className="text-muted text-[10px]">
                {abilityMod(draft[key])}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Details ===== */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={draft.saves}
            onChange={e => update({ saves: e.target.value })}
            label="Saving Throws"
            placeholder="Dex +4, Wis +2"
          />
          <Input
            value={draft.skills}
            onChange={e => update({ skills: e.target.value })}
            label="Skills"
            placeholder="Perception +4, Stealth +6"
          />
          <Input
            value={draft.resistances}
            onChange={e => update({ resistances: e.target.value })}
            label="Resistances"
            placeholder="fire, cold"
          />
          <Input
            value={draft.immunities}
            onChange={e => update({ immunities: e.target.value })}
            label="Immunities"
            placeholder="poison"
          />
          <Input
            value={draft.vulnerabilities}
            onChange={e => update({ vulnerabilities: e.target.value })}
            label="Vulnerabilities"
            placeholder="radiant"
          />
          <Input
            value={draft.conditionImmunities}
            onChange={e => update({ conditionImmunities: e.target.value })}
            label="Condition Immunities"
            placeholder="poisoned, charmed"
          />
          <Input
            value={draft.senses}
            onChange={e => update({ senses: e.target.value })}
            label="Senses"
            placeholder="Darkvision 60 ft."
          />
          <Input
            value={draft.languages}
            onChange={e => update({ languages: e.target.value })}
            label="Languages"
            placeholder="Common, Sylvan"
          />
        </div>

        {/* ===== Inflicted conditions ===== */}
        <NpcInflictsEditor
          conditions={draft.inflictableConditions}
          library={conditionLibrary}
          officialConditions={officialConditions}
          officialConditionsLoading={officialConditionsLoading}
          onChange={inflictableConditions => update({ inflictableConditions })}
          onCreateInLibrary={handleCreateConditionInLibrary}
        />

        {/* CR & Proficiency Bonus */}
        <div className="grid grid-cols-2 gap-2">
          <div className="w-full">
            <Input
              value={draft.cr}
              onChange={e => update({ cr: e.target.value })}
              label="CR"
              placeholder="0"
            />
          </div>
          <NumberInput
            value={derived.proficiencyBonus}
            onChange={v => update({ proficiencyOverride: v ?? 2 })}
            label="Prof Bonus"
            min={2}
            max={9}
            title="Proficiency bonus (auto-calculated from CR, overridable)"
          />
        </div>

        {/* Hit Dice */}
        <div>
          <label className="text-heading mb-1.5 block text-sm font-medium">
            Hit Dice
          </label>
          <div className="grid grid-cols-3 gap-2">
            <NumberInput
              value={draft.hitDiceMax}
              onChange={v => update({ hitDiceMax: v ?? 0 })}
              label="Max"
              min={0}
              placeholder="8"
            />
            <SelectField
              label="Die Type"
              value={draft.hitDieType}
              onValueChange={v => update({ hitDieType: v })}
            >
              {DIE_TYPES.map(d => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectField>
            <NumberInput
              value={draft.hitDieCurrent}
              onChange={v => update({ hitDieCurrent: v ?? 0 })}
              label="Current"
              min={0}
              placeholder="8"
            />
          </div>
        </div>

        {/* Passive Abilities */}
        <div>
          <label className="text-heading mb-1.5 block text-sm font-medium">
            Passive Abilities
            <span className="text-faint ml-1 text-xs font-normal">
              (auto-calculated, overridable)
            </span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <NumberInput
              value={derived.passivePerception}
              onChange={v =>
                update(d => withPassiveOverride(d, 'perception', v ?? 0))
              }
              label="Passive Perception"
              min={1}
            />
            <NumberInput
              value={derived.passiveInsight}
              onChange={v =>
                update(d => withPassiveOverride(d, 'insight', v ?? 0))
              }
              label="Passive Insight"
              min={1}
            />
            <NumberInput
              value={derived.passiveInvestigation}
              onChange={v =>
                update(d => withPassiveOverride(d, 'investigation', v ?? 0))
              }
              label="Passive Investigation"
              min={1}
            />
          </div>
        </div>
      </div>

      {/* ===== Class Resources ===== */}
      <NpcResourcesEditor
        resources={draft.resources}
        onChange={resources => update({ resources })}
        onDeleteResource={onDeleteResource}
      />

      {/* ===== Traits / Actions / Reactions ===== */}
      <AbilityListEditor
        section="traits"
        items={draft.traits}
        onChange={traits => update({ traits })}
        resources={draft.resources}
        inventoryItems={draft.inventoryItems}
      />
      <AbilityListEditor
        section="actions"
        items={draft.actions}
        onChange={actions => update({ actions })}
        resources={draft.resources}
        inventoryItems={draft.inventoryItems}
      />
      <AbilityListEditor
        section="bonusActions"
        items={draft.bonusActions}
        onChange={bonusActions => update({ bonusActions })}
        resources={draft.resources}
        inventoryItems={draft.inventoryItems}
      />
      <AbilityListEditor
        section="reactions"
        items={draft.reactions}
        onChange={reactions => update({ reactions })}
        resources={draft.resources}
        inventoryItems={draft.inventoryItems}
      />
      <AbilityListEditor
        section="lairActions"
        items={draft.lairActions}
        onChange={lairActions => update({ lairActions })}
        resources={draft.resources}
        inventoryItems={draft.inventoryItems}
      />
    </>
  );
}
