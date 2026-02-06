'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { WeaponInventory } from '@/components/WeaponInventory';
import ArmorDefenseManager from '@/components/ArmorDefenseManager';
import { Badge } from '@/components/ui/layout/badge';
import { CharacterState } from '@/types/character';

interface EquipmentSectionProps {
  character: CharacterState;
}

// Simple collapsible component for subsections
interface CollapsibleSubsectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  persistKey: string;
  badge?: React.ReactNode;
}

const CollapsibleSubsection: React.FC<CollapsibleSubsectionProps> = ({
  title,
  icon,
  children,
  defaultExpanded = true,
  persistKey,
  badge,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    const savedState = localStorage.getItem(
      `equipment-subsection-${persistKey}`
    );
    if (savedState !== null) {
      setIsExpanded(JSON.parse(savedState));
    }
  }, [persistKey]);

  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem(
      `equipment-subsection-${persistKey}`,
      JSON.stringify(newState)
    );
  };

  return (
    <div className="border-divider bg-surface-raised rounded-lg border shadow">
      <button
        onClick={toggleExpanded}
        className="hover:bg-surface-hover flex w-full items-center justify-between p-4 text-left transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h3 className="text-heading text-lg font-bold">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-divider border-t p-6">{children}</div>
      )}
    </div>
  );
};

export default function EquipmentSection({ character }: EquipmentSectionProps) {
  const equippedArmor = character.armorItems.filter(armor => armor.isEquipped);
  const attunedItems =
    character.magicItems.filter(item => item.isAttuned).length +
    character.weapons.filter(weapon => weapon.isAttuned).length;

  return (
    <div className="space-y-6">
      {/* Equipment & Magic Items - Collapsible */}
      <CollapsibleSubsection
        title="Equipment & Magic Items"
        icon="⚔️"
        persistKey="equipment-magic-items"
        defaultExpanded={true}
        badge={
          <div className="flex items-center gap-2">
            {character.weapons.length > 0 && (
              <Badge variant="primary" size="sm">
                {character.weapons.length} weapons
              </Badge>
            )}
            {character.magicItems.length > 0 && (
              <Badge variant="info" size="sm">
                {character.magicItems.length} items
              </Badge>
            )}
            {attunedItems > 0 && (
              <Badge variant="warning" size="sm">
                {attunedItems} attuned
              </Badge>
            )}
          </div>
        }
      >
        <ErrorBoundary
          fallback={
            <div className="border-accent-red-border bg-accent-red-bg rounded-lg border p-4">
              <p className="text-accent-red-text-muted">
                Unable to load equipment inventory
              </p>
            </div>
          }
        >
          <WeaponInventory />
        </ErrorBoundary>
      </CollapsibleSubsection>

      {/* Armor & Defense - Collapsible */}
      <CollapsibleSubsection
        title="Armor & Defense"
        icon="🛡️"
        persistKey="armor-defense"
        defaultExpanded={true}
        badge={
          <div className="flex items-center gap-2">
            {character.armorItems.length > 0 && (
              <Badge variant="info" size="sm">
                {character.armorItems.length} pieces
              </Badge>
            )}
            {equippedArmor.length > 0 && (
              <Badge variant="success" size="sm">
                {equippedArmor.length} equipped
              </Badge>
            )}
          </div>
        }
      >
        <ErrorBoundary
          fallback={
            <div className="border-accent-red-border bg-accent-red-bg rounded-lg border p-4">
              <p className="text-accent-red-text-muted">
                Unable to load armor management
              </p>
            </div>
          }
        >
          <ArmorDefenseManager />
        </ErrorBoundary>
      </CollapsibleSubsection>
    </div>
  );
}
