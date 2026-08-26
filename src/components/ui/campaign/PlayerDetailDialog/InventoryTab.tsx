'use client';

import React from 'react';
import { Swords, Gem, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';
import { SectionTitle, ensureArray } from './shared';
import { CharacterState } from '@/types/character';

interface InventoryTabProps {
  char: CharacterState;
}

export function InventoryTab({ char }: InventoryTabProps) {
  return (
    <div className="space-y-6">
      <WeaponsSection char={char} />
      <MagicItemsSection char={char} />
      <ArmorSection char={char} />
    </div>
  );
}

function WeaponsSection({ char }: { char: CharacterState }) {
  const weapons = ensureArray<(typeof char.weapons)[number]>(char.weapons);
  if (weapons.length === 0) return null;

  return (
    <div>
      <SectionTitle icon={<Swords size={14} />}>Weapons</SectionTitle>
      <div className="space-y-1.5">
        {weapons.map((w, index) => (
          <div
            key={w.id || `${w.name}-${index}`}
            className="bg-surface-secondary flex items-center justify-between rounded-lg px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-medium ${w.isEquipped ? 'text-heading' : 'text-muted'}`}
              >
                {w.name}
              </span>
              {w.isEquipped && (
                <Badge variant="success" size="sm">
                  Equipped
                </Badge>
              )}
              {w.isAttuned && (
                <Badge variant="info" size="sm">
                  Attuned
                </Badge>
              )}
            </div>
            <span className="text-muted text-xs">
              {ensureArray<(typeof w.damage)[number]>(w.damage)
                .map(d => `${d.dice} ${d.type}`)
                .join(', ') || '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MagicItemsSection({ char }: { char: CharacterState }) {
  const items = ensureArray<(typeof char.magicItems)[number]>(char.magicItems);
  if (items.length === 0) return null;

  return (
    <div>
      <SectionTitle icon={<Gem size={14} />}>Magic Items</SectionTitle>
      <div className="space-y-1.5">
        {items.map((item, index) => (
          <div
            key={item.id || `${item.name}-${index}`}
            className="bg-surface-secondary flex items-center justify-between rounded-lg px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-heading text-sm font-medium">
                {item.name}
              </span>
              {item.rarity && <RarityBadge rarity={item.rarity} />}
              {item.isAttuned && (
                <Badge variant="info" size="sm">
                  Attuned
                </Badge>
              )}
              {item.isEquipped && (
                <Badge variant="success" size="sm">
                  Equipped
                </Badge>
              )}
            </div>
            {item.chargePool && (
              <span className="text-muted text-xs">
                {item.chargePool.maxCharges - item.chargePool.usedCharges}/
                {item.chargePool.maxCharges} charges
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ArmorSection({ char }: { char: CharacterState }) {
  const armor = ensureArray<(typeof char.armorItems)[number]>(char.armorItems);
  if (armor.length === 0) return null;

  return (
    <div>
      <SectionTitle icon={<Shield size={14} />}>Armor</SectionTitle>
      <div className="space-y-1.5">
        {armor.map((a, index) => (
          <div
            key={a.id || `${a.name}-${index}`}
            className="bg-surface-secondary flex items-center justify-between rounded-lg px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-medium ${a.isEquipped ? 'text-heading' : 'text-muted'}`}
              >
                {a.name}
              </span>
              {a.isEquipped && (
                <Badge variant="success" size="sm">
                  Equipped
                </Badge>
              )}
              <span className="text-muted text-xs capitalize">
                {a.category}
              </span>
            </div>
            <span className="text-body text-sm font-medium">
              AC {a.baseAC + (a.enhancementBonus ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RarityBadge({ rarity }: { rarity: string }) {
  const variantMap: Record<
    string,
    'neutral' | 'success' | 'info' | 'warning' | 'danger' | 'primary'
  > = {
    common: 'neutral',
    uncommon: 'success',
    rare: 'info',
    'very rare': 'warning',
    legendary: 'danger',
    artifact: 'primary',
  };
  return (
    <Badge variant={variantMap[rarity] ?? 'neutral'} size="sm">
      {rarity}
    </Badge>
  );
}
