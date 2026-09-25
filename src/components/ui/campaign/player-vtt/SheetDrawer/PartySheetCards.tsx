'use client';

import { Shield, Zap } from 'lucide-react';

import type { PartyMemberHP } from '@/app/api/campaign/[code]/party-hp/route';
import { Badge } from '@/components/ui/layout/badge';
import { getHpTierBarColor } from '@/utils/hpColor';
import { hpPercent, hpTier } from '@/utils/hpState';

import { HEADING_CLASS, SECTION_CLASS } from './sheetSectionStyles';

const TILE_CLASS =
  'border-divider bg-surface rounded-lg border p-2 text-center';
const VALUE_CLASS = 'text-heading text-xl font-bold';
const LABEL_CLASS = 'text-faint text-xs uppercase';

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
    <div className={SECTION_CLASS}>
      <h3 className={HEADING_CLASS}>Condition</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-heading text-lg font-bold">
          {hpState || 'Unknown'}
        </span>
        {hp && (
          <span className="text-muted text-xs">
            {hp.current}/{hp.max}
          </span>
        )}
      </div>
      {hp && (
        <div className="bg-surface-secondary mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={`h-full rounded-full ${getHpTierBarColor(hpTier(hpPercent(hp.current, hp.max)))}`}
            style={{ width: `${hpPercent(hp.current, hp.max)}%` }}
          />
        </div>
      )}
      {(concentration || conditions.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {concentration && (
            <Badge variant="info">
              <Zap className="mr-1 h-3 w-3" />
              {concentration}
            </Badge>
          )}
          {conditions.map((name, index) => (
            <Badge key={`${index}-${name}`} variant="danger">
              {name}
            </Badge>
          ))}
        </div>
      )}
    </div>
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
    <div className={SECTION_CLASS}>
      <h3 className={HEADING_CLASS}>Stats</h3>
      <div className="grid grid-cols-3 gap-2">
        <div className={TILE_CLASS}>
          <div
            className={`${VALUE_CLASS} flex items-center justify-center gap-1`}
          >
            <Shield className="h-4 w-4" />
            {armorClass}
          </div>
          <div className={LABEL_CLASS}>AC</div>
        </div>
        <div className={TILE_CLASS}>
          <div className={VALUE_CLASS}>{speed} ft</div>
          <div className={LABEL_CLASS}>Speed</div>
        </div>
        <div className={TILE_CLASS}>
          <div className={VALUE_CLASS}>{passivePerception}</div>
          <div className={LABEL_CLASS}>Passive Perception</div>
        </div>
      </div>
    </div>
  );
}

export function GearCard({ equippedGear }: { equippedGear: string[] }) {
  return (
    <div className={SECTION_CLASS}>
      <h3 className={HEADING_CLASS}>Equipped, visible to the party</h3>
      {equippedGear.length === 0 ? (
        <p className="text-muted text-sm">Nothing equipped.</p>
      ) : (
        <ul className="text-body space-y-1 text-sm">
          {equippedGear.map(name => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
