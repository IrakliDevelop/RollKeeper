'use client';

import type { ClassFeature } from '@/types/classes';
import type { CharacterAbilities } from '@/types/character';
import type { CantripUpgrade } from '@/utils/cantripScaling';
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
  migrationFeatures?: ClassFeature[];
  migrationSpellGrants?: SubclassSpellGrant[];
  asiChoice?: ASIChoice;
  abilities: CharacterAbilities;
  hpRollResult?: number;
  hitDie: number;
  conModifier: number;
  hpGained?: number;
  retroactiveHp?: number;
  newLevelHp?: number;
  minimumAdjustment?: number;
  isCustomClass: boolean;
  spellsKnownDelta: number;
  cantripsKnownDelta: number;
  cantripUpgrades: CantripUpgrade[];
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
  migrationFeatures = [],
  migrationSpellGrants = [],
  asiChoice,
  abilities,
  hpRollResult,
  hitDie,
  conModifier,
  hpGained,
  retroactiveHp = 0,
  newLevelHp,
  minimumAdjustment = 0,
  isCustomClass,
  spellsKnownDelta,
  cantripsKnownDelta,
  cantripUpgrades,
}: ConfirmationStepProps) {
  const displayFeatures = [
    ...features,
    ...subclassFeatures,
    ...migrationFeatures,
  ].filter(
    f => f.name !== 'Ability Score Improvement' && f.name !== 'Epic Boon'
  );
  const autoGrantedSpells = [
    ...subclassSpellGrants,
    ...migrationSpellGrants,
  ].filter(g => g.grantType !== 'expanded');
  return (
    <div className="space-y-5">
      <div>
        <h3 className="type-subheading text-heading">Review level-up</h3>
        <p className="type-body text-muted mt-1">
          Review your changes before applying.
        </p>
      </div>
      <dl className="divide-divider border-divider divide-y border-t">
        <div className="flex flex-wrap justify-between gap-2 py-3">
          <dt className="type-ui text-heading font-semibold">Level</dt>
          <dd className="type-ui text-body">
            {className} {oldClassLevel} → {newClassLevel}
            {oldTotalLevel !== oldClassLevel && (
              <span className="type-caption text-muted ml-2">
                (total level {newTotalLevel})
              </span>
            )}
          </dd>
        </div>
        {selectedSubclass && (
          <div className="flex flex-wrap justify-between gap-2 py-3">
            <dt className="type-ui text-heading font-semibold">Subclass</dt>
            <dd className="type-ui text-body">{selectedSubclass}</dd>
          </div>
        )}
        {displayFeatures.length > 0 && (
          <div className="py-3">
            <dt className="type-ui text-heading font-semibold">Features</dt>
            <dd>
              <ul className="type-body text-body mt-2 list-disc pl-5">
                {displayFeatures.map(feature => (
                  <li key={`${feature.name}-${feature.level}`}>
                    {feature.name}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {autoGrantedSpells.length > 0 && (
          <div className="py-3">
            <dt className="type-ui text-heading font-semibold">
              Subclass spells
            </dt>
            <dd>
              <ul className="type-body text-body mt-2 list-disc pl-5">
                {autoGrantedSpells.map(grant => (
                  <li key={grant.spellName}>
                    {grant.spellName} (always prepared)
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {asiChoice && (
          <div className="py-3">
            {asiChoice.type === 'asi' ? (
              <>
                <dt className="type-ui text-heading font-semibold">
                  Ability scores
                </dt>
                <dd>
                  <ul className="type-body text-body mt-2 list-disc pl-5">
                    {asiChoice.increases.map(inc => (
                      <li key={inc.ability}>
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
                </dd>
              </>
            ) : (
              <>
                <dt className="type-ui text-heading font-semibold">Feat</dt>
                <dd className="type-body text-body mt-2">
                  {asiChoice.feat.name}
                  {asiChoice.grantedSpells.length > 0 && (
                    <span className="type-caption text-muted ml-1">
                      (+{asiChoice.grantedSpells.length} spell
                      {asiChoice.grantedSpells.length > 1 ? 's' : ''})
                    </span>
                  )}
                </dd>
              </>
            )}
          </div>
        )}
        {hpRollResult !== undefined && (
          <div className="flex flex-wrap justify-between gap-2 py-3">
            <dt className="type-ui text-heading font-semibold">HP</dt>
            <dd className="type-ui text-body text-right">
              <p>
                d{hitDie}: {hpRollResult} + CON {conModifier >= 0 ? '+' : ''}
                {conModifier}
              </p>
              {newLevelHp !== undefined && <p>This level: +{newLevelHp} HP</p>}
              {retroactiveHp !== 0 && (
                <p>
                  Earlier levels (CON): {retroactiveHp > 0 ? '+' : ''}
                  {retroactiveHp} HP
                </p>
              )}
              {minimumAdjustment !== 0 && (
                <p>Minimum HP adjustment: +{minimumAdjustment}</p>
              )}
              <p>
                Total HP gained:{' '}
                {hpGained !== undefined && hpGained >= 0 ? '+' : ''}
                {hpGained}
              </p>
            </dd>
          </div>
        )}
        {cantripUpgrades.length > 0 && (
          <div className="py-3">
            <dt className="type-ui text-heading font-semibold">
              Cantrip damage increases
            </dt>
            <dd>
              <ul className="type-body text-body mt-2 list-disc pl-5">
                {cantripUpgrades.map((upgrade, index) => (
                  <li key={`${upgrade.name}-${index}`}>
                    {upgrade.name}: {upgrade.from} → {upgrade.to}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>
      {isCustomClass && (
        <p className="type-caption text-muted">
          Custom class — update features and abilities manually.
        </p>
      )}
      {(spellsKnownDelta > 0 || cantripsKnownDelta > 0) && (
        <p className="type-caption text-muted">
          {cantripsKnownDelta > 0 &&
            `You can learn ${cantripsKnownDelta} new cantrip${cantripsKnownDelta > 1 ? 's' : ''}. `}
          {spellsKnownDelta > 0 &&
            `You can learn ${spellsKnownDelta} new spell${spellsKnownDelta > 1 ? 's' : ''}. `}
          Choose them on the Spells tab.
        </p>
      )}
    </div>
  );
}
