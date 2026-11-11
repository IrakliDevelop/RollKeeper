import type { CSSProperties, ReactNode } from 'react';

import { formatUsesLabel } from '@/utils/encounterConverter';
import {
  creatureInitiativeModifier,
  creatureMetaLine,
} from '../NpcLibrary/NpcLibrary.utils';
import { formatMod } from '../PlayerDetailDialog/shared';
import {
  abilityMod,
  cleanHtmlForExport,
  EXPORT_PALETTE as P,
} from './NPCStatBlockExport.utils';

import type {
  CampaignNPC,
  MonsterStatBlock,
  StatBlockEntry,
} from '@/types/encounter';

const ABILITIES = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
] as const;

const sectionStyle: CSSProperties = {
  borderTop: `1px solid ${P.divider}`,
  paddingTop: 8,
  marginTop: 8,
};

function Row({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 6, padding: '2px 0', fontSize: 13 }}>
      <span
        style={{
          fontWeight: 600,
          color: P.heading,
          marginRight: 6,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span style={{ color: P.body }}>{value}</span>
    </div>
  );
}

function EntrySection({
  title,
  entries,
}: {
  title: string;
  entries: StatBlockEntry[] | undefined;
}): ReactNode {
  if (!entries?.length) return null;
  return (
    <div style={sectionStyle}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: P.heading,
          paddingBottom: 4,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {entries.map((entry, index) => {
        const usesLabel = formatUsesLabel(entry.name, entry.uses);
        return (
          <div
            key={entry.id ?? `${entry.name}-${index}`}
            style={{ fontSize: 13, marginBottom: 4 }}
          >
            <span
              style={{
                fontWeight: 600,
                fontStyle: 'italic',
                color: P.heading,
              }}
            >
              {entry.name}.{usesLabel ? ` (${usesLabel})` : ''}
            </span>{' '}
            <span
              style={{ color: P.body }}
              dangerouslySetInnerHTML={{
                __html: cleanHtmlForExport(entry.text),
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function sensesLine(sb: MonsterStatBlock): string {
  if (sb.senses?.toLowerCase().includes('passive perception')) return sb.senses;
  return sb.senses
    ? `${sb.senses}, passive Perception ${sb.passivePerception}`
    : `passive Perception ${sb.passivePerception}`;
}

/** The pure inline-styled sheet that gets captured: no classes or custom
 *  properties, because html-to-image cannot resolve them. */
export function StatBlockImage({
  npc,
  avatarDataUrl,
}: {
  npc: CampaignNPC;
  avatarDataUrl: string | null;
}) {
  const sb = npc.monsterStatBlock;
  if (!sb) return null;

  const meta = [creatureMetaLine(npc), sb.alignment]
    .filter(Boolean)
    .join(' · ');
  const hitPoints = sb.hpFormula
    ? `${npc.maxHp} (${sb.hpFormula})`
    : String(npc.maxHp);
  const hasDefences =
    sb.resistances ||
    sb.immunities ||
    sb.vulnerabilities ||
    sb.conditionImmunities.length > 0;

  return (
    <div
      style={{
        padding: 24,
        background: P.background,
        fontFamily: P.font,
        color: P.body,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 16,
        }}
      >
        {avatarDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarDataUrl}
            alt={npc.name}
            style={{
              width: 80,
              height: 80,
              borderRadius: 6,
              objectFit: 'cover',
            }}
          />
        )}
        <div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: P.heading,
              margin: '0 0 4px',
            }}
          >
            {npc.name}
          </div>
          {meta && (
            <div style={{ fontSize: 13, color: P.muted, fontStyle: 'italic' }}>
              {meta}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 4,
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        {ABILITIES.map(({ key, label }) => (
          <div key={key}>
            <div style={{ fontSize: 11, fontWeight: 600, color: P.heading }}>
              {label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: P.heading }}>
              {sb[key]}
            </div>
            <div style={{ fontSize: 11, color: P.muted }}>
              ({abilityMod(sb[key])})
            </div>
          </div>
        ))}
      </div>

      <div style={sectionStyle}>
        <Row label="Armor class" value={npc.armorClass} />
        <Row label="Hit points" value={hitPoints} />
        <Row
          label="Initiative"
          value={formatMod(creatureInitiativeModifier(npc))}
        />
        <Row label="Speed" value={sb.speed || npc.speed} />
        <Row label="Saves" value={sb.saves} />
        <Row label="Skills" value={sb.skills} />
      </div>

      {hasDefences && (
        <div style={sectionStyle}>
          <Row label="Resistances" value={sb.resistances} />
          <Row label="Immunities" value={sb.immunities} />
          <Row label="Vulnerabilities" value={sb.vulnerabilities} />
          <Row
            label="Condition immunities"
            value={sb.conditionImmunities.join(', ')}
          />
        </div>
      )}

      <div style={sectionStyle}>
        <Row label="Senses" value={sensesLine(sb)} />
        <Row label="Languages" value={sb.languages} />
      </div>

      <EntrySection title="Traits" entries={sb.traits} />
      <EntrySection title="Actions" entries={sb.actions} />
      <EntrySection title="Bonus actions" entries={sb.bonusActions} />
      <EntrySection title="Reactions" entries={sb.reactions} />
      <EntrySection title="Lair actions" entries={sb.lairActions} />
    </div>
  );
}
