'use client';

import { Switch } from '@/components/ui/forms/switch';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import type { NPCSpellcastingAbility } from '@/types/encounter';
import { FULL_CASTER_SPELL_SLOTS } from '@/utils/constants';
import { getNPCSpellcastingAbilityScore } from '@/utils/npcSpellcasting';
import { NPCSpellListEditor } from '../NPCSpellListEditor';
import type { NpcFormDraft, NpcFormUpdate } from './npcFormDraft';

interface SpellsTabProps {
  draft: NpcFormDraft;
  update: NpcFormUpdate;
  proficiencyBonus: number;
}

export function SpellsTab({ draft, update, proficiencyBonus }: SpellsTabProps) {
  return (
    <>
      {/* ===== Spellcasting ===== */}
      <div className="space-y-3">
        {/* Enable toggle */}
        <div className="flex items-center gap-2">
          <Switch
            checked={draft.spellcastingEnabled}
            onCheckedChange={v => update({ spellcastingEnabled: v })}
            id="spellcasting-enabled"
          />
          <label
            htmlFor="spellcasting-enabled"
            className="text-body text-sm font-medium"
          >
            Enable Spellcasting
          </label>
        </div>

        {draft.spellcastingEnabled && (
          <div className="space-y-3">
            {/* Caster Level + Ability */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted mb-1 block text-xs font-medium">
                  Caster Level
                </label>
                <NumberInput
                  min={1}
                  max={20}
                  value={draft.casterLevel}
                  onChange={v => update({ casterLevel: v ?? 1 })}
                />
              </div>
              <div>
                <label className="text-muted mb-1 block text-xs font-medium">
                  Spellcasting Ability
                </label>
                <SelectField
                  value={draft.spellcastingAbility}
                  onValueChange={v =>
                    update({
                      spellcastingAbility: v as NPCSpellcastingAbility,
                    })
                  }
                >
                  <SelectItem value="intelligence">Intelligence</SelectItem>
                  <SelectItem value="wisdom">Wisdom</SelectItem>
                  <SelectItem value="charisma">Charisma</SelectItem>
                </SelectField>
              </div>
            </div>

            {/* Auto-calculated display */}
            {(() => {
              const abilityScore = getNPCSpellcastingAbilityScore(
                draft.spellcastingAbility,
                {
                  str: draft.str,
                  dex: draft.dex,
                  con: draft.con,
                  int: draft.int,
                  wis: draft.wis,
                  cha: draft.cha,
                }
              );
              const prof = proficiencyBonus;
              const autoAttack = Math.floor((abilityScore - 10) / 2) + prof;
              const autoDC = 8 + Math.floor((abilityScore - 10) / 2) + prof;
              return (
                <p className="text-muted text-xs">
                  Auto: Spell Attack{' '}
                  <span className="font-semibold">
                    {autoAttack >= 0 ? `+${autoAttack}` : autoAttack}
                  </span>
                  , Save DC <span className="font-semibold">{autoDC}</span> (
                  {draft.spellcastingAbility.charAt(0).toUpperCase() +
                    draft.spellcastingAbility.slice(1)}{' '}
                  {abilityScore}, Prof +{prof})
                </p>
              );
            })()}

            {/* Override fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted mb-1 block text-xs font-medium">
                  Spell Attack Override
                </label>
                <NumberInput
                  placeholder="Auto"
                  value={draft.spellAttackOverride}
                  onChange={v => update({ spellAttackOverride: v })}
                  allowEmpty
                />
              </div>
              <div>
                <label className="text-muted mb-1 block text-xs font-medium">
                  Save DC Override
                </label>
                <NumberInput
                  placeholder="Auto"
                  value={draft.spellDCOverride}
                  onChange={v => update({ spellDCOverride: v })}
                  allowEmpty
                />
              </div>
            </div>

            {/* Spell Slot Overrides */}
            <div>
              <label className="text-muted mb-1 block text-xs font-medium">
                Spell Slots (by Caster Level {draft.casterLevel})
              </label>
              <div className="bg-surface-secondary border-divider rounded-md border p-2">
                <div className="space-y-1">
                  {(() => {
                    const baseSlots =
                      FULL_CASTER_SPELL_SLOTS[draft.casterLevel] ?? {};
                    const levels = Array.from({ length: 9 }, (_, i) => i + 1);
                    const activeLevels = levels.filter(
                      lvl =>
                        (baseSlots[lvl] ?? 0) > 0 ||
                        draft.spellSlotOverrides[lvl] !== undefined
                    );
                    if (activeLevels.length === 0) {
                      return (
                        <p className="text-muted text-xs italic">
                          No spell slots at this caster level.
                        </p>
                      );
                    }
                    return activeLevels.map(lvl => (
                      <div key={lvl} className="flex items-center gap-2">
                        <span className="text-body w-20 text-xs font-medium">
                          Level {lvl}: {baseSlots[lvl] ?? 0}
                        </span>
                        <NumberInput
                          min={0}
                          placeholder={String(baseSlots[lvl] ?? 0)}
                          value={draft.spellSlotOverrides[lvl]}
                          onChange={v => {
                            update(d => ({
                              spellSlotOverrides: {
                                ...d.spellSlotOverrides,
                                [lvl]: v,
                              },
                            }));
                          }}
                          allowEmpty
                          className="h-7 w-20 text-xs"
                        />
                        <span className="text-muted text-xs">override</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
            <div>
              <label className="text-muted mb-1 block text-xs font-medium">
                Spell List
              </label>
              <NPCSpellListEditor
                spells={draft.spells}
                onChange={spells => update({ spells })}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
