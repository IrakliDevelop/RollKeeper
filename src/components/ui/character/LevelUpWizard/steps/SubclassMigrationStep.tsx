'use client';

import { Checkbox } from '@/components/ui/forms/checkbox';
import type { ProcessedSubclass } from '@/types/classes';
import type {
  MissedSubclassFeature,
  SubclassSpellGrant,
} from '../LevelUpWizard.types';
import { WizardChoiceRow } from '../WizardChoiceRow';
import { RadioGroup } from '@/components/ui/forms/radio-group';

interface SubclassMigrationStepProps {
  className: string;
  currentLevel: number;
  subclasses: ProcessedSubclass[];
  selectedSubclass: ProcessedSubclass | undefined;
  onSelectSubclass: (subclass: ProcessedSubclass) => void;
  missedFeatures: MissedSubclassFeature[];
  missedSpellGrants: SubclassSpellGrant[];
  onToggleFeature: (featureKey: string) => void;
}

export default function SubclassMigrationStep({
  className,
  currentLevel,
  subclasses,
  selectedSubclass,
  onSelectSubclass,
  missedFeatures,
  missedSpellGrants,
  onToggleFeature,
}: SubclassMigrationStepProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="type-caption text-ember-text mb-2">Subclass not set</p>
        <h3 className="type-subheading text-heading">
          Choose your {className} subclass
        </h3>
        <p className="type-body text-muted mt-1">
          Your character is level {currentLevel} but has no subclass. Select one
          now to continue.
        </p>
      </div>
      <RadioGroup
        value={selectedSubclass?.id}
        onValueChange={value => {
          const subclass = subclasses.find(item => item.id === value);
          if (subclass) onSelectSubclass(subclass);
        }}
        aria-label="Subclass"
        className="border-divider gap-0 border-t"
      >
        {subclasses.map(sc => (
          <WizardChoiceRow
            key={sc.id}
            value={sc.id}
            title={sc.name}
            meta={sc.source}
          />
        ))}
      </RadioGroup>
      {selectedSubclass && missedFeatures.length > 0 && (
        <div>
          <h4 className="type-label-heading text-heading">
            Missed subclass features
          </h4>
          <p className="type-caption text-muted mt-1">
            These features were available at earlier levels. Toggle on any you
            haven&apos;t already added manually.
          </p>
          <ul className="divide-divider mt-2 divide-y">
            {missedFeatures.map(mf => {
              const key = `${mf.feature.name}-${mf.level}`;
              return (
                <li key={key} className="py-2">
                  <Checkbox
                    checked={mf.adopted}
                    onCheckedChange={() => onToggleFeature(key)}
                    label={mf.feature.name}
                    description={`Level ${mf.level}`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {selectedSubclass && missedSpellGrants.length > 0 && (
        <div>
          <h4 className="type-label-heading text-heading">
            Missed subclass spells
          </h4>
          <p className="type-caption text-muted mt-1">
            These spells will be added automatically.
          </p>
          <ul className="divide-divider mt-2 divide-y">
            {missedSpellGrants.map(grant => (
              <li
                key={grant.spellName}
                className="type-ui text-heading flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>{grant.spellName}</span>
                <span className="type-caption text-muted">Always prepared</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
