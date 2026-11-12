'use client';

import { Input } from '@/components/ui/forms/input';
import { Section } from '@/components/ui/layout/section';
import type { NpcFormDraft, NpcFormUpdate } from './npcFormDraft';

type DefenseKey =
  | 'saves'
  | 'skills'
  | 'resistances'
  | 'immunities'
  | 'vulnerabilities'
  | 'conditionImmunities'
  | 'senses'
  | 'languages';

const FIELDS: ReadonlyArray<{
  key: DefenseKey;
  label: string;
  placeholder: string;
}> = [
  { key: 'saves', label: 'Saving throws', placeholder: 'Dex +4, Wis +2' },
  { key: 'skills', label: 'Skills', placeholder: 'Perception +4, Stealth +6' },
  { key: 'resistances', label: 'Resistances', placeholder: 'fire, cold' },
  { key: 'immunities', label: 'Immunities', placeholder: 'poison' },
  { key: 'vulnerabilities', label: 'Vulnerabilities', placeholder: 'radiant' },
  {
    key: 'conditionImmunities',
    label: 'Condition immunities',
    placeholder: 'poisoned, charmed',
  },
  { key: 'senses', label: 'Senses', placeholder: 'Darkvision 60 ft.' },
  { key: 'languages', label: 'Languages', placeholder: 'Common, Sylvan' },
];

interface DefensesSectionProps {
  draft: NpcFormDraft;
  update: NpcFormUpdate;
}

export function DefensesSection({ draft, update }: DefensesSectionProps) {
  return (
    <Section level={3} heading="Defenses and senses">
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(({ key, label, placeholder }) => (
          <Input
            key={key}
            value={draft[key]}
            onChange={e =>
              update({ [key]: e.target.value } as Pick<
                NpcFormDraft,
                DefenseKey
              >)
            }
            label={label}
            placeholder={placeholder}
          />
        ))}
      </div>
    </Section>
  );
}
