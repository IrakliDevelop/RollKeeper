'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { EquippedWeapons } from '@/components/EquippedWeapons';
import { EnhancedQuickSpells } from '@/components/EnhancedQuickSpells';
import { ConcentrationTracker } from '@/components/ui/character';
import { Button } from '@/components/ui/forms';
import { CharacterState } from '@/types/character';

interface ActionsSectionProps {
  character: CharacterState;
  showAttackRoll: (
    name: string,
    roll: number,
    modifier: number,
    isCrit: boolean
  ) => void;
  showSavingThrow: (
    spellName: string,
    saveDC: number,
    saveType?: string,
    damage?: string,
    damageType?: string
  ) => void;
  showDamageRoll: (
    weaponName: string,
    damageRoll: string,
    damageType?: string,
    versatile?: boolean
  ) => void;
  animateRoll?: (notation: string) => Promise<unknown>;
  switchToTab: (tabId: string) => void;
  onStopConcentration: () => void;
}

// Simple collapsible component for subsections
interface CollapsibleSubsectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  persistKey: string;
  badge?: React.ReactNode;
  extraContent?: React.ReactNode;
}

const CollapsibleSubsection: React.FC<CollapsibleSubsectionProps> = ({
  title,
  icon,
  children,
  defaultExpanded = true,
  persistKey,
  badge,
  extraContent,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    const savedState = localStorage.getItem(`subsection-${persistKey}`);
    if (savedState !== null) {
      setIsExpanded(JSON.parse(savedState));
    }
  }, [persistKey]);

  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem(`subsection-${persistKey}`, JSON.stringify(newState));
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow">
      <div className="flex w-full items-center justify-between p-4">
        <button
          onClick={toggleExpanded}
          className="flex flex-1 items-center gap-2 text-left transition-colors hover:opacity-80"
          aria-expanded={isExpanded}
        >
          <span className="text-lg">{icon}</span>
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          {isExpanded ? <ChevronDown size={20} className="ml-2" /> : <ChevronRight size={20} className="ml-2" />}
        </button>
        <div className="flex items-center gap-2 ml-4">
          {badge}
          {extraContent}
        </div>
      </div>
      
      {isExpanded && (
        <div className="border-t border-gray-200 p-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default function ActionsSection({
  character,
  showAttackRoll,
  showSavingThrow,
  showDamageRoll,
  animateRoll,
  switchToTab,
  onStopConcentration,
}: ActionsSectionProps) {
  const equippedWeapons = character.weapons.filter(weapon => weapon.isEquipped);
  const actionSpells = character.spells.filter(spell =>
    (spell.level === 0 && spell.isPrepared) || // Only prepared cantrips
    (spell.level > 0 && spell.isPrepared) || // Prepared spells
    spell.isAlwaysPrepared // Always prepared spells
  );

  return (
    <div className="space-y-6">
        {/* Ready Weapons - Collapsible */}
        <CollapsibleSubsection
          title="Ready Weapons"
          icon="⚔️"
          persistKey="ready-weapons"
          defaultExpanded={true}
          badge={
            equippedWeapons.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-1 text-sm font-medium text-blue-800">
                {equippedWeapons.length} equipped
              </span>
            )
          }
        >
          <ErrorBoundary
            fallback={
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-red-600">Unable to load equipped weapons</p>
              </div>
            }
          >
            <EquippedWeapons
              showAttackRoll={showAttackRoll}
              showDamageRoll={showDamageRoll}
              animateRoll={animateRoll}
            />
          </ErrorBoundary>
        </CollapsibleSubsection>

        {/* Quick Spells - Collapsible */}
        <CollapsibleSubsection
          title="Quick Spells"
          icon="✨"
          persistKey="quick-spells"
          defaultExpanded={true}
          badge={
            actionSpells.length > 0 && (
              <span className="rounded-full bg-purple-100 px-2 py-1 text-sm font-medium text-purple-800">
                {actionSpells.length} ready
              </span>
            )
          }
          extraContent={
            <Button
              onClick={(e) => {
                e.stopPropagation();
                switchToTab('spellcasting');
              }}
              variant="ghost"
              size="xs"
              className="bg-purple-100 text-purple-700 hover:bg-purple-200 hover:text-purple-800"
            >
              Manage
            </Button>
          }
        >
          <ErrorBoundary
            fallback={
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-red-600">Unable to load quick spells</p>
              </div>
            }
          >
            <EnhancedQuickSpells
              showAttackRoll={showAttackRoll}
              showSavingThrow={showSavingThrow}
              showDamageRoll={showDamageRoll}
              animateRoll={animateRoll}
            />
          </ErrorBoundary>
        </CollapsibleSubsection>

        {/* Concentration Tracker */}
        {character.concentration.isConcentrating && (
          <ConcentrationTracker
            concentration={character.concentration}
            onStopConcentration={onStopConcentration}
          />
        )}
    </div>
  );
}
