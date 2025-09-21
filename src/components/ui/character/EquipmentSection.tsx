'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { WeaponInventory } from '@/components/WeaponInventory';
import ArmorDefenseManager from '@/components/ArmorDefenseManager';
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
    const savedState = localStorage.getItem(`equipment-subsection-${persistKey}`);
    if (savedState !== null) {
      setIsExpanded(JSON.parse(savedState));
    }
  }, [persistKey]);

  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem(`equipment-subsection-${persistKey}`, JSON.stringify(newState));
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow">
      <button
        onClick={toggleExpanded}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-50"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </div>
      </button>
      
      {isExpanded && (
        <div className="border-t border-gray-200 p-6">
          {children}
        </div>
      )}
    </div>
  );
};

export default function EquipmentSection({
  character,
}: EquipmentSectionProps) {
  const equippedWeapons = character.weapons.filter(weapon => weapon.isEquipped);
  const equippedArmor = character.armorItems.filter(armor => armor.isEquipped);
  const attunedItems = character.magicItems.filter(item => item.isAttuned).length +
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
              <span className="rounded-full bg-purple-100 px-2 py-1 text-sm font-medium text-purple-800">
                {character.weapons.length} weapons
              </span>
            )}
            {character.magicItems.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-1 text-sm font-medium text-blue-800">
                {character.magicItems.length} items
              </span>
            )}
            {attunedItems > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-sm font-medium text-amber-800">
                {attunedItems} attuned
              </span>
            )}
          </div>
        }
      >
        <ErrorBoundary
          fallback={
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-red-600">Unable to load equipment inventory</p>
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
              <span className="rounded-full bg-blue-100 px-2 py-1 text-sm font-medium text-blue-800">
                {character.armorItems.length} pieces
              </span>
            )}
            {equippedArmor.length > 0 && (
              <span className="rounded-full bg-green-100 px-2 py-1 text-sm font-medium text-green-800">
                {equippedArmor.length} equipped
              </span>
            )}
          </div>
        }
      >
        <ErrorBoundary
          fallback={
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-red-600">Unable to load armor management</p>
            </div>
          }
        >
          <ArmorDefenseManager />
        </ErrorBoundary>
      </CollapsibleSubsection>
    </div>
  );
}
