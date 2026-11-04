'use client';

import { Badge } from '@/components/ui/layout/badge';
import { Section } from '@/components/ui/layout/section';
import { ensureArray, sentenceCase } from './shared';
import { CharacterState } from '@/types/character';

interface InventoryTabProps {
  char: CharacterState;
}

export function InventoryTab({ char }: InventoryTabProps) {
  const weapons = ensureArray<(typeof char.weapons)[number]>(char.weapons);
  const items = ensureArray<(typeof char.magicItems)[number]>(char.magicItems);
  const armor = ensureArray<(typeof char.armorItems)[number]>(char.armorItems);

  if (weapons.length === 0 && items.length === 0 && armor.length === 0) {
    return (
      <p className="type-body text-muted py-12 text-center">
        No weapons, armor or magic items synced.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {weapons.length > 0 && (
        <Section level={3} heading="Weapons">
          <ul className="divide-divider divide-y">
            {weapons.map((w, index) => (
              <li
                key={w.id || `${w.name}-${index}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span
                    className={`type-ui ${w.isEquipped ? 'text-heading' : 'text-muted'}`}
                  >
                    {w.name}
                  </span>
                  {w.isEquipped && (
                    <Badge variant="neutral" size="sm">
                      Equipped
                    </Badge>
                  )}
                  {w.isAttuned && (
                    <Badge variant="neutral" size="sm">
                      Attuned
                    </Badge>
                  )}
                </div>
                <span className="type-small text-muted shrink-0 text-right">
                  {ensureArray<(typeof w.damage)[number]>(w.damage)
                    .map(d => `${d.dice} ${d.type}`)
                    .join(', ') || '—'}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {items.length > 0 && (
        <Section level={3} heading="Magic items">
          <ul className="divide-divider divide-y">
            {items.map((item, index) => (
              <li
                key={item.id || `${item.name}-${index}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="type-ui text-heading">{item.name}</span>
                  {item.rarity && (
                    <Badge variant="neutral" size="sm">
                      {sentenceCase(item.rarity)}
                    </Badge>
                  )}
                  {item.isAttuned && (
                    <Badge variant="neutral" size="sm">
                      Attuned
                    </Badge>
                  )}
                  {item.isEquipped && (
                    <Badge variant="neutral" size="sm">
                      Equipped
                    </Badge>
                  )}
                </div>
                {item.chargePool && (
                  <span className="type-small text-muted shrink-0 text-right">
                    {item.chargePool.maxCharges - item.chargePool.usedCharges}/
                    {item.chargePool.maxCharges} charges
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {armor.length > 0 && (
        <Section level={3} heading="Armor">
          <ul className="divide-divider divide-y">
            {armor.map((a, index) => (
              <li
                key={a.id || `${a.name}-${index}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span
                    className={`type-ui ${a.isEquipped ? 'text-heading' : 'text-muted'}`}
                  >
                    {a.name}
                  </span>
                  {a.isEquipped && (
                    <Badge variant="neutral" size="sm">
                      Equipped
                    </Badge>
                  )}
                  {a.category && (
                    <span className="type-small text-muted">
                      {sentenceCase(a.category)}
                    </span>
                  )}
                </div>
                <span className="type-ui text-body">
                  AC {a.baseAC + (a.enhancementBonus ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
