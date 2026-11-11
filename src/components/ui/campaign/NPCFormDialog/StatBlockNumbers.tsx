'use client';

import { Input } from '@/components/ui/forms/input';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Section } from '@/components/ui/layout/section';
import { DIE_TYPES, withPassiveOverride } from './npcFormDraft';
import type {
  NpcDerivedFields,
  NpcFormDraft,
  NpcFormUpdate,
} from './npcFormDraft';

interface ChallengeSectionProps {
  draft: NpcFormDraft;
  update: NpcFormUpdate;
  derived: NpcDerivedFields;
}

export function ChallengeSection({
  draft,
  update,
  derived,
}: ChallengeSectionProps) {
  return (
    <Section level={3} heading="Challenge">
      <div className="grid grid-cols-2 gap-3">
        <Input
          value={draft.cr}
          onChange={e => update({ cr: e.target.value })}
          label="CR"
          placeholder="1/2"
        />
        <NumberInput
          value={derived.proficiencyBonus}
          onChange={v => update({ proficiencyOverride: v ?? 2 })}
          label="Proficiency bonus"
          helperText="Starts from CR."
          min={2}
          max={9}
        />
      </div>
    </Section>
  );
}

interface PassiveScoresSectionProps {
  update: NpcFormUpdate;
  derived: NpcDerivedFields;
}

export function PassiveScoresSection({
  update,
  derived,
}: PassiveScoresSectionProps) {
  return (
    <Section level={3} heading="Passive scores" contentClassName="space-y-3">
      <p className="type-small text-muted">
        Worked out from Wisdom and Intelligence. Change one to set all three by
        hand.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <NumberInput
          value={derived.passivePerception}
          onChange={v =>
            update(d => withPassiveOverride(d, 'perception', v ?? 0))
          }
          label="Perception"
          aria-label="Passive Perception"
          min={1}
        />
        <NumberInput
          value={derived.passiveInsight}
          onChange={v => update(d => withPassiveOverride(d, 'insight', v ?? 0))}
          label="Insight"
          aria-label="Passive Insight"
          min={1}
        />
        <NumberInput
          value={derived.passiveInvestigation}
          onChange={v =>
            update(d => withPassiveOverride(d, 'investigation', v ?? 0))
          }
          label="Investigation"
          aria-label="Passive Investigation"
          min={1}
        />
      </div>
    </Section>
  );
}

interface HitDiceSectionProps {
  draft: NpcFormDraft;
  update: NpcFormUpdate;
}

export function HitDiceSection({ draft, update }: HitDiceSectionProps) {
  return (
    <Section level={3} heading="Hit dice">
      <div className="grid grid-cols-3 gap-3">
        <NumberInput
          value={draft.hitDiceMax}
          onChange={v => update({ hitDiceMax: v ?? 0 })}
          label="Total"
          aria-label="Hit dice total"
          min={0}
          placeholder="8"
        />
        <SelectField
          label="Die"
          triggerProps={{ 'aria-label': 'Hit die' }}
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
          label="Remaining"
          aria-label="Hit dice remaining"
          min={0}
          placeholder="8"
        />
      </div>
    </Section>
  );
}
