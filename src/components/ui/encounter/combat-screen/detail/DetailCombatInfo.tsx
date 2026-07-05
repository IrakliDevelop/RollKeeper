'use client';

import React from 'react';
import type { MonsterStatBlock } from '@/types/encounter';
import type { DetailSectionProps } from './DetailHeader';

interface InfoRowProps {
  label: string;
  value?: string;
  editable?: boolean;
  onChange?: (v: string) => void;
}

function InfoRow({ label, value, editable, onChange }: InfoRowProps) {
  if (!editable && !value) return null;
  return (
    <div className="flex items-start gap-3 py-1">
      <span className="text-muted w-36 shrink-0 text-xs font-semibold">
        {label}
      </span>
      {editable ? (
        <input
          type="text"
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

  const hasAnyData =
    sb != null ||
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

  return (
    <div className="border-divider space-y-0 border-t p-4">
      <h3 className="text-heading mb-1 text-xs font-semibold tracking-wider uppercase">
        Combat Details
      </h3>
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
        </>
      ) : (
        <>
          <StaticRow label="Speed" value={sb?.speed} />
          <StaticRow label="Saving Throws" value={sb?.saves} />
        </>
      )}
      <StaticRow label="Skills" value={sb?.skills} />
      <StaticRow label="Resistances" value={resistances} />
      <StaticRow label="Immunities" value={immunities} />
      <StaticRow label="Vulnerabilities" value={sb?.vulnerabilities} />
      <StaticRow label="Condition Immunities" value={condImmunities} />
      <StaticRow label="Senses" value={senses} />
      <StaticRow label="Languages" value={sb?.languages} />
      {sb?.passivePerception != null && (
        <StaticRow
          label="Passive Perception"
          value={String(sb.passivePerception)}
        />
      )}
    </div>
  );
}
