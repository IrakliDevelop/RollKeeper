'use client';

import { Check, ArrowUp, Sparkles, BookOpen, Heart, Sword } from 'lucide-react';
import type { ClassFeature } from '@/types/classes';
import type { CharacterAbilities } from '@/types/character';
import type { ASIChoice, SubclassSpellGrant } from '../LevelUpWizard.types';

interface ConfirmationStepProps {
  className: string;
  oldClassLevel: number;
  newClassLevel: number;
  oldTotalLevel: number;
  newTotalLevel: number;
  selectedSubclass?: string;
  features: ClassFeature[];
  subclassFeatures: ClassFeature[];
  subclassSpellGrants: SubclassSpellGrant[];
  asiChoice?: ASIChoice;
  abilities: CharacterAbilities;
  hpRollResult?: number;
  hitDie: number;
  conModifier: number;
  isCustomClass: boolean;
  spellsKnownDelta: number;
  cantripsKnownDelta: number;
}

export default function ConfirmationStep({
  className,
  oldClassLevel,
  newClassLevel,
  oldTotalLevel,
  newTotalLevel,
  selectedSubclass,
  features,
  subclassFeatures,
  subclassSpellGrants,
  asiChoice,
  abilities,
  hpRollResult,
  hitDie,
  conModifier,
  isCustomClass,
  spellsKnownDelta,
  cantripsKnownDelta,
}: ConfirmationStepProps) {
  const displayFeatures = [...features, ...subclassFeatures].filter(
    f => f.name !== 'Ability Score Improvement' && f.name !== 'Epic Boon'
  );

  const autoGrantedSpells = subclassSpellGrants.filter(
    g => g.grantType !== 'expanded'
  );

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-heading text-lg font-semibold">Level Up Summary</h3>
        <p className="text-muted mt-1 text-sm">
          Review your changes before applying.
        </p>
      </div>

      <div className="border-divider bg-surface-raised space-y-3 rounded-lg border p-4">
        {/* Level */}
        <div className="flex items-center gap-2">
          <ArrowUp size={14} className="text-accent-emerald-text" />
          <span className="text-heading text-sm font-medium">
            {className} {oldClassLevel} → {newClassLevel}
          </span>
          {oldTotalLevel !== oldClassLevel && (
            <span className="text-muted text-xs">(Total: {newTotalLevel})</span>
          )}
        </div>

        {/* Subclass */}
        {selectedSubclass && (
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-accent-purple-text" />
            <span className="text-heading text-sm">
              Subclass: <span className="font-medium">{selectedSubclass}</span>
            </span>
          </div>
        )}

        {/* Features */}
        {displayFeatures.length > 0 && (
          <div className="flex items-start gap-2">
            <BookOpen size={14} className="text-accent-amber-text mt-0.5" />
            <div>
              <span className="text-heading text-sm font-medium">
                Features:
              </span>
              <ul className="text-body mt-1 space-y-0.5 text-sm">
                {displayFeatures.map((f, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <Check
                      size={12}
                      className="text-accent-emerald-text flex-shrink-0"
                    />
                    {f.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Subclass spells */}
        {autoGrantedSpells.length > 0 && (
          <div className="flex items-start gap-2">
            <Sparkles size={14} className="text-accent-purple-text mt-0.5" />
            <div>
              <span className="text-heading text-sm font-medium">
                Subclass Spells:
              </span>
              <ul className="text-body mt-1 space-y-0.5 text-sm">
                {autoGrantedSpells.map((g, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <Check
                      size={12}
                      className="text-accent-emerald-text flex-shrink-0"
                    />
                    {g.spellName} (always prepared)
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ASI / Feat */}
        {asiChoice && (
          <div className="flex items-start gap-2">
            <Sword size={14} className="text-accent-blue-text mt-0.5" />
            <div>
              {asiChoice.type === 'asi' ? (
                <>
                  <span className="text-heading text-sm font-medium">
                    Ability Scores:
                  </span>
                  <ul className="text-body mt-1 space-y-0.5 text-sm">
                    {asiChoice.increases.map((inc, i) => (
                      <li key={i}>
                        {inc.ability.charAt(0).toUpperCase() +
                          inc.ability.slice(1)}
                        : {abilities[inc.ability as keyof CharacterAbilities]} →{' '}
                        {Math.min(
                          20,
                          abilities[inc.ability as keyof CharacterAbilities] +
                            inc.amount
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <span className="text-heading text-sm">
                  Feat:{' '}
                  <span className="font-medium">{asiChoice.feat.name}</span>
                  {asiChoice.grantedSpells.length > 0 && (
                    <span className="text-muted">
                      {' '}
                      (+{asiChoice.grantedSpells.length} spell
                      {asiChoice.grantedSpells.length > 1 ? 's' : ''})
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        )}

        {/* HP */}
        {hpRollResult !== undefined && (
          <div className="flex items-center gap-2">
            <Heart size={14} className="text-accent-red-text" />
            <span className="text-heading text-sm">
              HP: +{Math.max(1, hpRollResult + conModifier)} (d{hitDie}:{' '}
              {hpRollResult} + CON: {conModifier >= 0 ? '+' : ''}
              {conModifier})
            </span>
          </div>
        )}

        {/* Custom class note */}
        {isCustomClass && (
          <p className="text-muted text-xs italic">
            Custom class — update features and abilities manually.
          </p>
        )}

        {/* Spell notes */}
        {(spellsKnownDelta > 0 || cantripsKnownDelta > 0) && (
          <div className="border-divider mt-2 border-t pt-2">
            <p className="text-muted text-xs">
              {cantripsKnownDelta > 0 &&
                `You can learn ${cantripsKnownDelta} new cantrip${cantripsKnownDelta > 1 ? 's' : ''}. `}
              {spellsKnownDelta > 0 &&
                `You can learn ${spellsKnownDelta} new spell${spellsKnownDelta > 1 ? 's' : ''}. `}
              Visit the Spells tab to choose.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
