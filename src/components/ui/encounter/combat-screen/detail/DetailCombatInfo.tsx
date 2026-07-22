'use client';

import React from 'react';
import type { MonsterStatBlock } from '@/types/encounter';
import type { DetailSectionProps } from './DetailHeader';

interface InfoRowProps {
  label: string;
  value?: string;
  editable?: boolean;
  type?: 'text' | 'number';
  onChange?: (v: string) => void;
}

function InfoRow({
  label,
  value,
  editable,
  type = 'text',
  onChange,
}: InfoRowProps) {
  if (!editable && !value) return null;
  return (
    <div className="flex items-start gap-3 py-1">
      <span className="text-muted w-36 shrink-0 text-xs font-semibold">
        {label}
      </span>
      {editable ? (
        <input
          type={type}
          defaultValue={value ?? ''}
          onBlur={e => onChange?.(e.target.value)}
          className="bg-surface-raised border-divider text-body flex-1 rounded border px-2 py-0.5 text-xs"
          aria-label={label}
        />
      ) : (
        <span className="text-body text-xs">{value}</span>
      )}
    </div>
  );
}

function StaticRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-1">
      <span className="text-muted w-36 shrink-0 text-xs font-semibold">
        {label}
      </span>
      <span className="text-body text-xs">{value}</span>
    </div>
  );
}

function sbField(
  sb: MonsterStatBlock,
  field: keyof MonsterStatBlock
): string | undefined {
  const val = sb[field];
  if (typeof val === 'string' && val.length > 0) return val;
  if (typeof val === 'number') return String(val);
  return undefined;
}

export function DetailCombatInfo({ entity, actions }: DetailSectionProps) {
  const sb = entity.monsterStatBlock;
  const isPlayer = entity.type === 'player';
  const canEdit = !isPlayer && sb != null;
  const canEditBasics = !isPlayer;

  const resistances =
    (sb != null ? sbField(sb, 'resistances') : undefined) ??
    entity.damageResistances?.join(', ');
  const immunities =
    (sb != null ? sbField(sb, 'immunities') : undefined) ??
    entity.damageImmunities?.join(', ');
  const condImmunities =
    sb?.conditionImmunities?.join(', ') ??
    entity.conditionImmunities?.join(', ');
  const senses =
    (sb != null ? sbField(sb, 'senses') : undefined) ??
    entity.senses?.map(s => `${s.name} ${s.range} ft.`).join(', ');

  // Editable input is type="number" — a "+" prefix is invalid number syntax
  // and the browser blanks the field, so only the static display gets the sign.
  const initiativeModValue = String(entity.initiativeModifier);
  const initiativeModDisplay =
    entity.initiativeModifier >= 0
      ? `+${entity.initiativeModifier}`
      : String(entity.initiativeModifier);
  const proficiencyBonusValue =
    entity.proficiencyBonus != null
      ? String(entity.proficiencyBonus)
      : undefined;
  const passivePerceptionValue =
    sb?.passivePerception != null ? String(sb.passivePerception) : undefined;

  const hasAnyData =
    sb != null ||
    entity.initiativeModifier !== 0 ||
    entity.proficiencyBonus != null ||
    (entity.damageResistances?.length ?? 0) > 0 ||
    (entity.damageImmunities?.length ?? 0) > 0 ||
    (entity.conditionImmunities?.length ?? 0) > 0 ||
    (entity.senses?.length ?? 0) > 0;

  if (!hasAnyData) return null;

  const updateSb = (field: keyof MonsterStatBlock, value: string) => {
    if (!sb) return;
    actions.onUpdate(entity.id, {
      monsterStatBlock: { ...sb, [field]: value },
    });
  };

  const updatePassivePerception = (value: string) => {
    if (!sb) return;
    const num = parseInt(value, 10);
    if (Number.isNaN(num)) return;
    actions.onUpdate(entity.id, {
      monsterStatBlock: { ...sb, passivePerception: num },
    });
  };

  const updateConditionImmunities = (value: string) => {
    if (!sb) return;
    const list = value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    actions.onUpdate(entity.id, {
      monsterStatBlock: { ...sb, conditionImmunities: list },
    });
  };

  const updateInitiativeModifier = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === '') return;
    const num = parseInt(trimmed, 10);
    if (!Number.isNaN(num))
      actions.onUpdate(entity.id, { initiativeModifier: num });
  };

  const updateProficiencyBonus = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === '') return;
    const num = parseInt(trimmed, 10);
    if (!Number.isNaN(num))
      actions.onUpdate(entity.id, { proficiencyBonus: num });
  };

  return (
    <div className="border-divider space-y-0 border-t p-4">
      <h3 className="text-heading mb-1 text-xs font-semibold tracking-wider uppercase">
        Combat Details
      </h3>
      {canEditBasics ? (
        <>
          <InfoRow
            label="Initiative Mod"
            value={initiativeModValue}
            editable
            type="number"
            onChange={updateInitiativeModifier}
          />
          <InfoRow
            label="Proficiency Bonus"
            value={proficiencyBonusValue}
            editable
            type="number"
            onChange={updateProficiencyBonus}
          />
        </>
      ) : (
        <>
          <StaticRow label="Initiative Mod" value={initiativeModDisplay} />
          <StaticRow label="Proficiency Bonus" value={proficiencyBonusValue} />
        </>
      )}
      {canEdit ? (
        <>
          <InfoRow
            label="Speed"
            value={sb?.speed}
            editable
            onChange={v => updateSb('speed', v)}
          />
          <InfoRow
            label="Saving Throws"
            value={sb?.saves}
            editable
            onChange={v => updateSb('saves', v)}
          />
          <InfoRow
            label="Skills"
            value={sb?.skills}
            editable
            onChange={v => updateSb('skills', v)}
          />
          <InfoRow
            label="Resistances"
            value={resistances}
            editable
            onChange={v => updateSb('resistances', v)}
          />
          <InfoRow
            label="Immunities"
            value={immunities}
            editable
            onChange={v => updateSb('immunities', v)}
          />
          <InfoRow
            label="Vulnerabilities"
            value={sb?.vulnerabilities}
            editable
            onChange={v => updateSb('vulnerabilities', v)}
          />
          <InfoRow
            label="Condition Immunities"
            value={condImmunities}
            editable
            onChange={updateConditionImmunities}
          />
          <InfoRow
            label="Senses"
            value={senses}
            editable
            onChange={v => updateSb('senses', v)}
          />
          <InfoRow
            label="Languages"
            value={sb?.languages}
            editable
            onChange={v => updateSb('languages', v)}
          />
          <InfoRow
            label="Passive Perception"
            value={passivePerceptionValue}
            editable
            type="number"
            onChange={updatePassivePerception}
          />
        </>
      ) : (
        <>
          <StaticRow label="Speed" value={sb?.speed} />
          <StaticRow label="Saving Throws" value={sb?.saves} />
          <StaticRow label="Skills" value={sb?.skills} />
          <StaticRow label="Resistances" value={resistances} />
          <StaticRow label="Immunities" value={immunities} />
          <StaticRow label="Vulnerabilities" value={sb?.vulnerabilities} />
          <StaticRow label="Condition Immunities" value={condImmunities} />
          <StaticRow label="Senses" value={senses} />
          <StaticRow label="Languages" value={sb?.languages} />
          <StaticRow
            label="Passive Perception"
            value={passivePerceptionValue}
          />
        </>
      )}
    </div>
  );
}
