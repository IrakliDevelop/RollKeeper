'use client';

import { useId, useMemo, type ReactNode } from 'react';
import { calculateCharacterArmorClass } from '@/utils/calculations';
import { Switch } from '@/components/ui/forms';
import { InPlaceField } from '@/components/ui/forms/InPlaceField';
import { Section } from '@/components/ui/layout/section';
import { AcShield } from '@/components/ui/game/AcShield';
import { cn } from '@/utils/cn';
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
  /**
   * `rows` (default) is the labelled list the map dock's AC dialog uses.
   * `ledger` is the sheet's layout: the shield is the total and the parts
   * sit beside it with their switches underneath.
   */
  layout?: 'rows' | 'ledger';
}

export default function ArmorClassManager({
  character,
  editing = true,
  onUpdateArmorClass,
  onUpdateTempArmorClass,
  onSetTempACActive,
  onSetShieldEquipped,
  onUpdateShieldBonus,
  layout = 'rows',
}: ArmorClassManagerProps) {
  if (layout === 'ledger') {
    return (
      <AcLedger
        character={character}
        editing={editing}
        onUpdateArmorClass={onUpdateArmorClass}
        onUpdateTempArmorClass={onUpdateTempArmorClass}
        onSetTempACActive={onSetTempACActive}
        onSetShieldEquipped={onSetShieldEquipped}
        onUpdateShieldBonus={onUpdateShieldBonus}
      />
    );
  }

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

interface AcBuffBreakdown {
  additive: number;
  override: { value: number; name: string } | null;
  floor: { value: number; name: string } | null;
}

/** What the active temporary buffs do to AC, for both layouts. */
function getAcBuffBreakdown(
  temporaryBuffs: CharacterState['temporaryBuffs'] | undefined
): AcBuffBreakdown {
  const activeBuffs = (temporaryBuffs || []).filter(b => b.isActive);
  let additive = 0;
  let override: AcBuffBreakdown['override'] = null;
  let floor: AcBuffBreakdown['floor'] = null;

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
}

// Extracted formula display that accounts for buff effects
function ACFormulaDisplay({ character }: { character: CharacterState }) {
  const totalAC = calculateCharacterArmorClass(character);

  const buffBreakdown = useMemo(
    () => getAcBuffBreakdown(character.temporaryBuffs),
    [character.temporaryBuffs]
  );

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

/** One ledger column: the number on top, its caption or switch below. */
function LedgerPart({
  sign,
  off,
  value,
  caption,
}: {
  sign?: string;
  off?: boolean;
  value: ReactNode;
  caption: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <div
        className={cn(
          'type-num-lg flex h-13 items-center tabular-nums',
          off ? 'text-muted' : 'text-heading'
        )}
      >
        {sign && <span className="text-muted mr-0.5">{sign}</span>}
        {value}
      </div>
      {caption}
    </div>
  );
}

/** A switch with its visible caption beneath, so the column stays narrow. */
function CaptionSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <>
      <Switch size="sm" id={id} checked={checked} onCheckedChange={onChange} />
      <label htmlFor={id} className="type-caption text-muted">
        {label}
      </label>
    </>
  );
}

function AcLedger({
  character,
  editing,
  onUpdateArmorClass,
  onUpdateTempArmorClass,
  onSetTempACActive,
  onSetShieldEquipped,
  onUpdateShieldBonus,
}: Omit<ArmorClassManagerProps, 'layout'> & { editing: boolean }) {
  const buffs = useMemo(
    () => getAcBuffBreakdown(character.temporaryBuffs),
    [character.temporaryBuffs]
  );
  const hasBuffLines = buffs.additive !== 0 || buffs.override || buffs.floor;

  return (
    <Section heading="Armor class" level={3}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <LedgerPart
          value={<AcShield value={calculateCharacterArmorClass(character)} />}
          caption={<span className="type-caption text-muted">Total</span>}
        />
        <LedgerPart
          value={
            <InPlaceField
              label="Base AC"
              value={character.armorClass}
              editing={editing}
              min={0}
              max={30}
              onCommit={onUpdateArmorClass}
            />
          }
          caption={<span className="type-caption text-muted">Base AC</span>}
        />
        <LedgerPart
          sign="+"
          off={!character.isWearingShield}
          value={
            <InPlaceField
              label="Shield bonus"
              value={character.shieldBonus}
              editing={editing}
              min={0}
              max={5}
              onCommit={onUpdateShieldBonus}
            />
          }
          caption={
            <CaptionSwitch
              label="Shield"
              checked={character.isWearingShield}
              onChange={onSetShieldEquipped}
            />
          }
        />
        <LedgerPart
          sign="+"
          off={!character.isTempACActive}
          value={
            <InPlaceField
              label="Temp AC"
              value={character.tempArmorClass}
              editing
              min={0}
              max={20}
              onCommit={onUpdateTempArmorClass}
            />
          }
          caption={
            <CaptionSwitch
              label="Temp AC"
              checked={character.isTempACActive}
              onChange={onSetTempACActive}
            />
          }
        />
      </div>
      {hasBuffLines && (
        <div className="type-small text-muted mt-3 space-y-1">
          {buffs.override && (
            <p>
              {buffs.override.value} ({buffs.override.name})
            </p>
          )}
          {buffs.additive !== 0 && (
            <p>
              {buffs.additive > 0 ? '+' : '−'} {Math.abs(buffs.additive)} (From
              temporary buffs)
            </p>
          )}
          {buffs.floor && (
            <p>
              Minimum AC {buffs.floor.value} from {buffs.floor.name}
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
