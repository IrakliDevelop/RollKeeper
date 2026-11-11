'use client';

import { Switch } from '@/components/ui/forms/switch';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Section } from '@/components/ui/layout/section';
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

const SLOT_LEVELS = Array.from({ length: 9 }, (_, i) => i + 1);
const OVERRIDE_HELP = 'Leave empty to use the worked-out value.';

export function SpellsTab({ draft, update, proficiencyBonus }: SpellsTabProps) {
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
  const modifier = Math.floor((abilityScore - 10) / 2);
  const workedOutAttack = modifier + proficiencyBonus;
  const workedOutDC = 8 + modifier + proficiencyBonus;
  const abilityName =
    draft.spellcastingAbility.charAt(0).toUpperCase() +
    draft.spellcastingAbility.slice(1);

  const baseSlots = FULL_CASTER_SPELL_SLOTS[draft.casterLevel] ?? {};
  const activeSlotLevels = SLOT_LEVELS.filter(
    lvl =>
      (baseSlots[lvl] ?? 0) > 0 || draft.spellSlotOverrides[lvl] !== undefined
  );

  return (
    <>
      <Switch
        checked={draft.spellcastingEnabled}
        onCheckedChange={v => update({ spellcastingEnabled: v })}
        label="Spellcasting"
        description="Adds a Spells tab to this NPC."
      />

      {draft.spellcastingEnabled && (
        <>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="Caster level"
                min={1}
                max={20}
                value={draft.casterLevel}
                onChange={v => update({ casterLevel: v ?? 1 })}
              />
              <SelectField
                label="Spellcasting ability"
                value={draft.spellcastingAbility}
                onValueChange={v =>
                  update({ spellcastingAbility: v as NPCSpellcastingAbility })
                }
              >
                <SelectItem value="intelligence">Intelligence</SelectItem>
                <SelectItem value="wisdom">Wisdom</SelectItem>
                <SelectItem value="charisma">Charisma</SelectItem>
              </SelectField>
            </div>

            <p className="type-small text-muted">
              {`Worked out: spell attack ${workedOutAttack >= 0 ? '+' : ''}${workedOutAttack}, spell save DC ${workedOutDC} (${abilityName} ${abilityScore}, proficiency bonus +${proficiencyBonus}).`}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="Spell attack bonus"
                helperText={OVERRIDE_HELP}
                placeholder={`${workedOutAttack >= 0 ? '+' : ''}${workedOutAttack}`}
                value={draft.spellAttackOverride}
                onChange={v => update({ spellAttackOverride: v })}
                allowEmpty
              />
              <NumberInput
                label="Spell save DC"
                helperText={OVERRIDE_HELP}
                placeholder={String(workedOutDC)}
                value={draft.spellDCOverride}
                onChange={v => update({ spellDCOverride: v })}
                allowEmpty
              />
            </div>
          </div>

          <Section
            level={3}
            heading={`Spell slots at caster level ${draft.casterLevel}`}
          >
            {activeSlotLevels.length === 0 ? (
              <p className="type-body text-muted">
                No spell slots at this caster level.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {activeSlotLevels.map(lvl => (
                  <NumberInput
                    key={lvl}
                    label={`Level ${lvl} slots`}
                    min={0}
                    placeholder={String(baseSlots[lvl] ?? 0)}
                    value={draft.spellSlotOverrides[lvl]}
                    onChange={v =>
                      update(d => ({
                        spellSlotOverrides: {
                          ...d.spellSlotOverrides,
                          [lvl]: v,
                        },
                      }))
                    }
                    allowEmpty
                  />
                ))}
              </div>
            )}
          </Section>

          <NPCSpellListEditor
            spells={draft.spells}
            onChange={spells => update({ spells })}
          />
        </>
      )}
    </>
  );
}
