'use client';

import React from 'react';
import {
  setDraftInitiative,
  setDraftProficiency,
  updateDraftStatBlock,
} from './monsterEditDraft';
import { abilityModifier } from '@/utils/encounterConverter';
import type { MonsterEditDraft } from './monsterEditDraft';
import type { MonsterStatBlock } from '@/types/encounter';

interface StatBlockEditorStatsProps {
  draft: MonsterEditDraft;
  onDraftChange: (draft: MonsterEditDraft) => void;
}

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

// Only string-valued MonsterStatBlock keys — keeps the computed-key patch
// `{ [f.key]: e.target.value }` assignable to Partial<MonsterStatBlock>.
type TextFieldKey =
  | 'speed'
  | 'saves'
  | 'skills'
  | 'resistances'
  | 'immunities'
  | 'vulnerabilities'
  | 'senses'
  | 'languages'
  | 'cr'
  | 'size'
  | 'type'
  | 'alignment';

const TEXT_FIELDS: Array<{ key: TextFieldKey; label: string }> = [
  { key: 'speed', label: 'Speed' },
  { key: 'saves', label: 'Saving Throws' },
  { key: 'skills', label: 'Skills' },
  { key: 'resistances', label: 'Resistances' },
  { key: 'immunities', label: 'Immunities' },
  { key: 'vulnerabilities', label: 'Vulnerabilities' },
  { key: 'senses', label: 'Senses' },
  { key: 'languages', label: 'Languages' },
  { key: 'cr', label: 'CR' },
  { key: 'size', label: 'Size' },
  { key: 'type', label: 'Type' },
  { key: 'alignment', label: 'Alignment' },
];

const FIELD_CLASSES =
  'border-divider bg-surface-secondary w-full rounded-[10px] border-[1.5px] px-3 py-2 text-sm focus:outline-none';

const LABEL_CLASSES =
  'text-muted mb-1 block text-[11px] font-extrabold tracking-wider uppercase';

/** Stats sub-tab of `StatBlockEditor` — ability scores, initiative/PB/passive
 * perception, and the descriptive text fields. Split out of the parent to
 * keep both files under the component-size guideline. */
export function StatBlockEditorStats({
  draft,
  onDraftChange,
}: StatBlockEditorStatsProps) {
  const patchBlock = (patch: Partial<MonsterStatBlock>) =>
    onDraftChange(updateDraftStatBlock(draft, patch));

  return (
    <div className="space-y-4">
      {/* Ability scores */}
      <div className="grid grid-cols-6 gap-1.5">
        {ABILITY_KEYS.map(ab => (
          <div key={ab} className="text-center">
            <label htmlFor={`ab-${ab}`} className={LABEL_CLASSES}>
              {ab}
            </label>
            <input
              id={`ab-${ab}`}
              aria-label={`${ab} score`}
              type="number"
              value={draft.statBlock[ab]}
              onChange={e =>
                patchBlock({ [ab]: parseInt(e.target.value, 10) || 0 })
              }
              className={`${FIELD_CLASSES} text-center font-bold`}
            />
            <span className="text-faint text-[11px] font-semibold">
              {abilityModifier(draft.statBlock[ab]) >= 0 ? '+' : ''}
              {abilityModifier(draft.statBlock[ab])}
            </span>
          </div>
        ))}
      </div>

      {/* Initiative + PB + passive perception */}
      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <label htmlFor="edit-init" className={LABEL_CLASSES}>
            Initiative
          </label>
          <input
            id="edit-init"
            aria-label="Initiative modifier"
            type="number"
            value={draft.initiativeModifier}
            onChange={e =>
              onDraftChange(
                setDraftInitiative(draft, parseInt(e.target.value, 10) || 0)
              )
            }
            className={FIELD_CLASSES}
          />
        </div>
        <div>
          <label htmlFor="edit-pb" className={LABEL_CLASSES}>
            Prof. Bonus
          </label>
          <input
            id="edit-pb"
            aria-label="Proficiency bonus"
            type="number"
            value={draft.proficiencyBonus}
            onChange={e =>
              onDraftChange(
                setDraftProficiency(draft, parseInt(e.target.value, 10) || 0)
              )
            }
            className={FIELD_CLASSES}
          />
        </div>
        <div>
          <label htmlFor="edit-pp" className={LABEL_CLASSES}>
            Passive Perc.
          </label>
          <input
            id="edit-pp"
            aria-label="Passive perception"
            type="number"
            value={draft.statBlock.passivePerception}
            onChange={e =>
              patchBlock({
                passivePerception: parseInt(e.target.value, 10) || 0,
              })
            }
            className={FIELD_CLASSES}
          />
        </div>
      </div>

      {/* Text fields */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {TEXT_FIELDS.map(f => (
          <div key={f.key}>
            <label htmlFor={`edit-${f.key}`} className={LABEL_CLASSES}>
              {f.label}
            </label>
            <input
              id={`edit-${f.key}`}
              aria-label={f.label}
              value={draft.statBlock[f.key]}
              onChange={e => patchBlock({ [f.key]: e.target.value })}
              className={FIELD_CLASSES}
            />
          </div>
        ))}
        <div>
          <label htmlFor="edit-condimm" className={LABEL_CLASSES}>
            Condition Immunities
          </label>
          <input
            id="edit-condimm"
            aria-label="Condition immunities"
            value={draft.statBlock.conditionImmunities.join(', ')}
            onChange={e =>
              patchBlock({
                conditionImmunities: e.target.value
                  .split(',')
                  .map(s => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="e.g. charmed, frightened"
            className={FIELD_CLASSES}
          />
        </div>
      </div>
    </div>
  );
}
