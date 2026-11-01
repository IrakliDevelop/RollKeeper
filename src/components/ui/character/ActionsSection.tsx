'use client';

import React, { useMemo } from 'react';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { EquippedWeapons } from '@/components/EquippedWeapons';
import { QuickSpells } from '@/components/QuickSpells';
import { QuickFeatures } from '@/components/QuickFeatures';
import { ConcentrationTracker } from '@/components/ui/character';
import { Button } from '@/components/ui/forms';
import { Badge } from '@/components/ui/layout';
import { Section } from '@/components/ui/layout/section';
import ClassResourceTracker from '@/components/ui/character/ClassResourceTracker';
import { getActiveClassResources } from '@/utils/classResources';
import { cn } from '@/utils/cn';
import { CharacterState } from '@/types/character';

interface ActionsSectionProps {
  editing?: boolean;
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
  showClassResources?: boolean;
  onUseClassResource?: (id: string, amount?: number) => void;
  onRestoreClassResource?: (id: string, amount?: number) => void;
  onResetClassResource?: (id: string) => void;
  spellSlotsPanel?: React.ReactNode;
}

function ActionsLoadFallback({ thing }: { thing: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      <p className="text-ember-text text-sm">{thing} didn&apos;t load.</p>
      <Button variant="link" size="sm" onClick={() => window.location.reload()}>
        Reload page
      </Button>
    </div>
  );
}

export default function ActionsSection({
  editing = false,
  character,
  showAttackRoll,
  showSavingThrow,
  showDamageRoll,
  animateRoll,
  switchToTab,
  onStopConcentration,
  showClassResources,
  onUseClassResource,
  onRestoreClassResource,
  onResetClassResource,
  spellSlotsPanel,
}: ActionsSectionProps) {
  const equippedWeapons = character.weapons.filter(weapon => weapon.isEquipped);
  // Intentionally narrow deps: only recompute when fields that affect
  // resource maxima change, not on every character mutation.
  const classResources = useMemo(
    () => (showClassResources ? getActiveClassResources(character) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      showClassResources,
      character.classes,
      character.class,
      character.level,
      character.totalLevel,
      character.abilities,
      character.classResources,
    ]
  );
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
      <Section
        heading="Ready weapons"
        level={3}
        collapsible="actions-ready-weapons"
        trailing={
          equippedWeapons.length > 0 && (
            <span className="text-muted text-sm">
              {equippedWeapons.length} equipped
            </span>
          )
        }
      >
        <ErrorBoundary fallback={<ActionsLoadFallback thing="Ready weapons" />}>
          <EquippedWeapons
            editing={editing}
            showAttackRoll={showAttackRoll}
            showDamageRoll={showDamageRoll}
            animateRoll={animateRoll}
          />
        </ErrorBoundary>
      </Section>

      {(spellSlotsPanel ||
        (classResources.length > 0 &&
          onUseClassResource &&
          onRestoreClassResource &&
          onResetClassResource)) && (
        <div
          className={cn(
            spellSlotsPanel &&
              classResources.length > 0 &&
              'grid items-start gap-6 lg:grid-cols-2'
          )}
        >
          {spellSlotsPanel}
          {classResources.length > 0 &&
            onUseClassResource &&
            onRestoreClassResource &&
            onResetClassResource && (
              <Section
                heading="Class resources"
                level={3}
                collapsible="class-resources"
              >
                <div className="divide-divider divide-y">
                  {classResources.map(resource => (
                    <div key={resource.definition.id} className="py-3">
                      <ClassResourceTracker
                        resource={resource}
                        onUse={onUseClassResource}
                        onRestore={onRestoreClassResource}
                        onReset={onResetClassResource}
                      />
                    </div>
                  ))}
                </div>
              </Section>
            )}
        </div>
      )}

      {(character.favoriteFeatureIds || []).length > 0 && (
        <Section
          heading="Quick features"
          level={3}
          collapsible="actions-quick-features"
          trailing={
            <>
              <span className="text-muted text-sm">
                {(character.favoriteFeatureIds || []).length} pinned
              </span>
              <Button
                onClick={e => {
                  e.stopPropagation();
                  switchToTab('features');
                }}
                variant="ghost"
                size="xs"
              >
                Manage
              </Button>
            </>
          }
        >
          <ErrorBoundary
            fallback={<ActionsLoadFallback thing="Quick features" />}
          >
            <QuickFeatures />
          </ErrorBoundary>
        </Section>
      )}

      <Section
        heading="Quick spells"
        level={3}
        collapsible="actions-quick-spells"
        trailing={
          <div className="flex items-center gap-2">
            {actionSpells.length > 0 && (
              <span className="text-muted text-sm">
                {actionSpells.length} ready
              </span>
            )}
            {preparedSpellsCount > 0 && (
              <Badge variant="neutral" size="sm">
                {preparedSpellsCount} prepared
              </Badge>
            )}
            <Button
              onClick={e => {
                e.stopPropagation();
                switchToTab('spellcasting');
              }}
              variant="ghost"
              size="xs"
            >
              Manage
            </Button>
          </div>
        }
      >
        <ErrorBoundary fallback={<ActionsLoadFallback thing="Quick spells" />}>
          <QuickSpells
            showAttackRoll={showAttackRoll}
            showSavingThrow={showSavingThrow}
            showDamageRoll={showDamageRoll}
            animateRoll={animateRoll}
          />
        </ErrorBoundary>
      </Section>

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
