'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { EquippedWeapons } from '@/components/EquippedWeapons';
import { EnhancedQuickSpells } from '@/components/EnhancedQuickSpells';
import { ConcentrationTracker } from '@/components/ui/character';
import { Button } from '@/components/ui/forms';
import { Badge } from '@/components/ui/layout';
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
    <div className="border-divider bg-surface-raised rounded-lg border shadow">
      <div className="flex w-full items-center justify-between p-4">
        <button
          onClick={toggleExpanded}
          className="flex flex-1 items-center gap-2 text-left transition-colors hover:opacity-80"
          aria-expanded={isExpanded}
        >
          <span className="text-lg">{icon}</span>
          <h3 className="text-heading text-lg font-bold">{title}</h3>
          {isExpanded ? (
            <ChevronDown size={20} className="ml-2" />
          ) : (
            <ChevronRight size={20} className="ml-2" />
          )}
        </button>
        <div className="ml-4 flex items-center gap-2">
          {badge}
          {extraContent}
        </div>
      </div>

      {isExpanded && (
        <div className="border-divider border-t p-4">{children}</div>
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
  const actionSpells = character.spells.filter(
    spell =>
      (spell.level === 0 && spell.isPrepared) || // Only prepared cantrips
      (spell.level > 0 && spell.isPrepared) || // Prepared spells
      spell.isAlwaysPrepared // Always prepared spells
  );

  // Calculate prepared spells count (excluding cantrips)
  const preparedSpellsCount = character.spells.filter(
    spell => spell.level > 0 && (spell.isPrepared || spell.isAlwaysPrepared)
  ).length;

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
            <span className="bg-accent-blue-bg text-accent-blue-text rounded-full px-2 py-1 text-sm font-medium">
              {equippedWeapons.length} equipped
            </span>
          )
        }
      >
        <ErrorBoundary
          fallback={
            <div className="border-accent-red-border bg-accent-red-bg rounded-lg border p-4">
              <p className="text-accent-red-text-muted">
                Unable to load equipped weapons
              </p>
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
          <div className="flex items-center gap-2">
            {actionSpells.length > 0 && (
              <span className="bg-accent-purple-bg text-accent-purple-text rounded-full px-2 py-1 text-sm font-medium">
                {actionSpells.length} ready
              </span>
            )}
            {preparedSpellsCount > 0 && (
              <Badge
                variant="success"
                size="sm"
                className="bg-accent-green-bg text-accent-green-text"
              >
                {preparedSpellsCount} prepared
              </Badge>
            )}
          </div>
        }
        extraContent={
          <Button
            onClick={e => {
              e.stopPropagation();
              switchToTab('spellcasting');
            }}
            variant="ghost"
            size="xs"
            className="bg-accent-purple-bg text-accent-purple-text-muted hover:bg-accent-purple-bg-strong hover:text-accent-purple-text"
          >
            Manage
          </Button>
        }
      >
        <ErrorBoundary
          fallback={
            <div className="border-accent-red-border bg-accent-red-bg rounded-lg border p-4">
              <p className="text-accent-red-text-muted">
                Unable to load quick spells
              </p>
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
