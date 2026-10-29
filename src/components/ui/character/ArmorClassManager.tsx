'use client';

import { useMemo } from 'react';
import { calculateCharacterArmorClass } from '@/utils/calculations';
import { Switch } from '@/components/ui/forms';
import { InPlaceField } from '@/components/ui/forms/InPlaceField';
import { Section } from '@/components/ui/layout/section';
import { AcShield } from '@/components/ui/game/AcShield';
import { CharacterState } from '@/types/character';

interface ArmorClassManagerProps {
  character: CharacterState;
  /**
   * Sheet mode: false shows base AC as plain text. Defaults to true — the
   * map dock's AC dialog stays editable.
   */
  editing?: boolean;
  onUpdateArmorClass: (ac: number) => void;
  onUpdateTempArmorClass: (tempAC: number) => void;
  onSetTempACActive: (active: boolean) => void;
  onSetShieldEquipped: (equipped: boolean) => void;
  onUpdateShieldBonus: (bonus: number) => void;
}

export default function ArmorClassManager({
  character,
  editing = true,
  onUpdateArmorClass,
  onUpdateTempArmorClass,
  onSetTempACActive,
  onSetShieldEquipped,
  onUpdateShieldBonus,
}: ArmorClassManagerProps) {
  return (
    <Section heading="Armor class" level={3}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <AcShield value={calculateCharacterArmorClass(character)} />
          <span className="type-caption text-muted">Total</span>
        </div>
        <div className="flex min-h-10 items-center justify-between gap-3 pointer-coarse:min-h-11">
          <span className="type-ui text-body">Base AC</span>
          <InPlaceField
            label="Base AC"
            value={character.armorClass}
            editing={editing}
            min={0}
            max={30}
            onCommit={onUpdateArmorClass}
            className="type-num-lg text-heading"
          />
        </div>
        <p className="type-small text-muted">Armor and Dexterity</p>
        <div className="flex min-h-10 items-center justify-between gap-3 pointer-coarse:min-h-11">
          <Switch
            label="Temp AC"
            checked={character.isTempACActive}
            onCheckedChange={onSetTempACActive}
          />
          <InPlaceField
            label="Temp AC"
            value={character.tempArmorClass}
            editing
            min={0}
            max={20}
            onCommit={onUpdateTempArmorClass}
            className="type-num-lg text-heading"
          />
        </div>
        <p className="type-small text-muted">
          Bonuses from spells and temporary magical effects
        </p>
        <div className="flex min-h-10 items-center justify-between gap-3 pointer-coarse:min-h-11">
          <Switch
            label="Shield"
            checked={character.isWearingShield}
            onCheckedChange={onSetShieldEquipped}
          />
          <InPlaceField
            label="Shield bonus"
            value={character.shieldBonus}
            editing={editing}
            min={0}
            max={5}
            onCommit={onUpdateShieldBonus}
            className="type-num-lg text-heading"
          />
        </div>
        <p className="type-small text-muted">Shield bonus to AC</p>
        <ACFormulaDisplay character={character} />
      </div>
    </Section>
  );
}

// Extracted formula display that accounts for buff effects
function ACFormulaDisplay({ character }: { character: CharacterState }) {
  const totalAC = calculateCharacterArmorClass(character);

  const buffBreakdown = useMemo(() => {
    const activeBuffs = (character.temporaryBuffs || []).filter(
      b => b.isActive
    );
    let additive = 0;
    let override: { value: number; name: string } | null = null;
    let floor: { value: number; name: string } | null = null;

    for (const buff of activeBuffs) {
      for (const effect of buff.effects) {
        if (effect.targetStat !== 'ac') continue;
        switch (effect.mode) {
          case 'add':
            additive += effect.value;
            break;
          case 'set':
            if (!override || effect.value > override.value) {
              override = { value: effect.value, name: buff.name };
            }
            break;
          case 'floor':
            if (!floor || effect.value > floor.value) {
              floor = { value: effect.value, name: buff.name };
            }
            break;
        }
      }
    }

    return { additive, override, floor };
  }, [character.temporaryBuffs]);

  return (
    <div className="type-small text-muted space-y-2">
      <p>
        {buffBreakdown.override ? (
          <>
            {buffBreakdown.override.value} ({buffBreakdown.override.name})
          </>
        ) : (
          <>
            {character.armorClass}
            {character.isTempACActive && character.tempArmorClass > 0 && (
              <> + {character.tempArmorClass}</>
            )}
          </>
        )}
        {character.isWearingShield && <> + {character.shieldBonus}</>}
        {buffBreakdown.additive !== 0 && (
          <>
            {' '}
            {buffBreakdown.additive > 0 ? '+' : '−'}{' '}
            {Math.abs(buffBreakdown.additive)} (From temporary buffs)
          </>
        )}
        {' = '}
        {totalAC}
      </p>
      {buffBreakdown.floor && (
        <p>
          Minimum AC {buffBreakdown.floor.value} from {buffBreakdown.floor.name}
        </p>
      )}
    </div>
  );
}
