'use client';

import type { PartyMemberHP } from '@/app/api/campaign/[code]/party-hp/route';
import { HPBar } from '@/components/shared/combat/HPBar';
import { ConditionChip } from '@/components/ui/game/ConditionChip';
import { Section } from '@/components/ui/layout/section';
import { cn } from '@/utils/cn';
import { getHpTierTextColor } from '@/utils/hpColor';
import { hpPercent, hpTier } from '@/utils/hpState';

// dt first keeps the markup a valid definition list; flex-col-reverse shows
// the value above its label.
const CELL_CLASS = 'flex flex-col-reverse';
const LABEL_CLASS = 'type-small text-muted';
const VALUE_CLASS = 'type-num-lg text-heading';

export function ConditionCard({
  member,
  hpState,
  concentration,
  conditions,
}: {
  member: PartyMemberHP;
  hpState: string;
  concentration: string | null;
  conditions: string[];
}) {
  const hp = member.hitPoints;
  return (
    <Section heading="Condition" level={4}>
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'type-ui',
              hp
                ? getHpTierTextColor(hpTier(hpPercent(hp.current, hp.max)))
                : 'text-heading'
            )}
          >
            {hpState || 'Unknown'}
          </span>
          {hp && (
            <span className="type-ui text-muted tabular-nums">
              {hp.current}/{hp.max}
            </span>
          )}
        </div>
        {hp && (
          <HPBar
            current={hp.current}
            max={hp.max}
            size="sm"
            showLabel={false}
          />
        )}
        {(concentration || conditions.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {concentration && (
              <ConditionChip
                kind="concentration"
                name={`Concentrating on ${concentration}`}
              />
            )}
            {conditions.map((name, index) => (
              <ConditionChip key={`${index}-${name}`} name={name} />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

export function StatsCard({
  armorClass,
  speed,
  passivePerception,
}: {
  armorClass: number;
  speed: number;
  passivePerception: number;
}) {
  return (
    <Section heading="Stats" level={4}>
      <dl className="grid grid-cols-3 gap-x-3">
        <div className={CELL_CLASS}>
          <dt className={LABEL_CLASS}>AC</dt>
          <dd className={VALUE_CLASS}>{armorClass}</dd>
        </div>
        <div className={CELL_CLASS}>
          <dt className={LABEL_CLASS}>Speed</dt>
          <dd className={VALUE_CLASS}>{speed} ft</dd>
        </div>
        <div className={CELL_CLASS}>
          <dt className={LABEL_CLASS}>Passive Perception</dt>
          <dd className={VALUE_CLASS}>{passivePerception}</dd>
        </div>
      </dl>
    </Section>
  );
}

export function GearCard({ equippedGear }: { equippedGear: string[] }) {
  return (
    <Section heading="Equipped, visible to the party" level={4}>
      {equippedGear.length === 0 ? (
        <p className="type-body text-muted">Nothing equipped.</p>
      ) : (
        <ul className="type-body text-body space-y-1">
          {equippedGear.map(name => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
    </Section>
  );
}
