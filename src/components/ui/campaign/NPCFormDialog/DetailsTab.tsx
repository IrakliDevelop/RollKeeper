'use client';

import { useId } from 'react';
import { Input } from '@/components/ui/forms/input';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Section } from '@/components/ui/layout/section';
import { BestiaryImport } from './BestiaryImport';
import { PortraitField } from './PortraitField';
import { TagsField } from './TagsField';
import { CREATURE_TYPES, SIZES } from '@/types/bestiary';
import type { ProcessedMonster } from '@/types/bestiary';
import type { CampaignCreatureKind } from '@/types/encounter';
import type {
  NpcDerivedFields,
  NpcFormDraft,
  NpcFormUpdate,
} from './npcFormDraft';
import type { usePortraitUpload } from './usePortraitUpload';

interface DetailsTabProps {
  kind: CampaignCreatureKind;
  isEdit: boolean;
  draft: NpcFormDraft;
  update: NpcFormUpdate;
  derived: NpcDerivedFields;
  existingGroups: string[];
  portrait: ReturnType<typeof usePortraitUpload>;
  onImport: (monster: ProcessedMonster) => void;
  onClearImport: () => void;
  onAddTag: (raw: string) => void;
  onRemoveTag: (tag: string) => void;
  onRemoveLastTag: () => void;
}

/** The standard list, plus the stored value when it isn't on it. */
function withStoredValue(list: readonly string[], stored: string): string[] {
  return stored && !list.includes(stored) ? [...list, stored] : [...list];
}

export function DetailsTab({
  kind,
  isEdit,
  draft,
  update,
  derived,
  existingGroups,
  portrait,
  onImport,
  onClearImport,
  onAddTag,
  onRemoveTag,
  onRemoveLastTag,
}: DetailsTabProps) {
  const groupListId = useId();

  return (
    <div className="space-y-5">
      {!isEdit && (
        <BestiaryImport
          sourceName={draft.bestiarySourceId ? draft.bestiarySourceName : null}
          onSelect={onImport}
          onClear={onClearImport}
        />
      )}

      <PortraitField url={draft.avatarUrl} portrait={portrait} />

      <div className="space-y-3">
        <Input
          value={draft.name}
          onChange={e => update({ name: e.target.value })}
          label="Name"
          placeholder={kind === 'monster' ? 'Dire wolf' : 'Brenn Ironhand'}
          required
        />
        <Input
          value={draft.description}
          onChange={e => update({ description: e.target.value })}
          label="Description"
          placeholder="Gruff smith who owes the guild money"
          helperText="Players never see this."
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField
          label="Size"
          value={draft.size}
          onValueChange={v => update({ size: v })}
        >
          {withStoredValue(SIZES, draft.size).map(size => (
            <SelectItem key={size} value={size}>
              {size}
            </SelectItem>
          ))}
        </SelectField>
        <SelectField
          label="Type"
          value={draft.creatureType}
          onValueChange={v => update({ creatureType: v })}
        >
          {withStoredValue(CREATURE_TYPES, draft.creatureType).map(type => (
            <SelectItem key={type} value={type}>
              {type}
            </SelectItem>
          ))}
        </SelectField>
        <Input
          value={draft.alignment}
          onChange={e => update({ alignment: e.target.value })}
          label="Alignment"
          placeholder="Unaligned"
        />
      </div>

      <Section level={3} heading="Library" contentClassName="space-y-3">
        <div>
          <Input
            value={draft.group}
            onChange={e => update({ group: e.target.value })}
            label="Group"
            list={groupListId}
            placeholder="Bandits"
            helperText="Shown as a heading in the library."
          />
          {existingGroups.length > 0 && (
            <datalist id={groupListId}>
              {existingGroups.map(group => (
                <option key={group} value={group} />
              ))}
            </datalist>
          )}
        </div>
        <TagsField
          tags={draft.tags}
          onAdd={onAddTag}
          onRemove={onRemoveTag}
          onRemoveLast={onRemoveLastTag}
        />
      </Section>

      <Section level={3} heading="Combat" contentClassName="space-y-3">
        <Input
          value={draft.ac}
          onChange={e => update({ ac: e.target.value })}
          label="AC"
          placeholder="16 (natural armor)"
          helperText="Free text — the leading number is used in combat."
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            value={draft.hp}
            onChange={v => update({ hp: v ?? 1 })}
            label="HP"
            min={1}
          />
          <Input
            value={draft.hpFormula}
            onChange={e => update({ hpFormula: e.target.value })}
            label="HP formula"
            placeholder="2d8+2"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberInput
            value={draft.tempHp}
            onChange={v => update({ tempHp: v ?? 0 })}
            label="Temporary HP"
            min={0}
            placeholder="0"
            helperText="Damage comes off these first."
          />
          <Input
            value={draft.tempAc}
            onChange={e => update({ tempAc: e.target.value })}
            label="Temporary AC bonus"
            placeholder="2 (shield spell)"
            helperText="Added to AC. Put the source after the number."
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            value={draft.speed}
            onChange={e => update({ speed: e.target.value })}
            label="Speed"
            placeholder="30 ft., fly 60 ft."
          />
          <NumberInput
            value={derived.initiativeModifier}
            onChange={v => update({ initiativeOverride: v ?? 0 })}
            label="Initiative modifier"
            helperText="Starts from Dexterity."
          />
          <NumberInput
            value={draft.xp}
            onChange={v => update({ xp: v ?? 0 })}
            label="XP"
            min={0}
            placeholder="0"
            helperText="Awarded when the party defeats them."
          />
        </div>
      </Section>
    </div>
  );
}
