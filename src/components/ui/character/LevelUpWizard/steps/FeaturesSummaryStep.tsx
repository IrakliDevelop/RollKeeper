'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import type { ClassFeature } from '@/types/classes';
import type { SubclassSpellGrant } from '../LevelUpWizard.types';
import { WizardChoiceRow } from '../WizardChoiceRow';
import { RadioGroup } from '@/components/ui/forms/radio-group';

interface FeaturesSummaryStepProps {
  className: string;
  newLevel: number;
  features: ClassFeature[];
  subclassFeatures: ClassFeature[];
  subclassName?: string;
  subclassSpellGrants: SubclassSpellGrant[];
  featureChoices: Record<string, string>;
  onFeatureChoiceChange: (featureName: string, optionName: string) => void;
}

function FeatureRow({
  feature,
  selectedOption,
  onOptionSelect,
}: {
  feature: ClassFeature;
  selectedOption?: string;
  onOptionSelect: (optionName: string) => void;
}) {
  const [expanded, setExpanded] = useState(!!feature.choice);
  const hasDetails = !!feature.choice || !!feature.entries?.length;
  if (!hasDetails)
    return (
      <li className="border-divider flex min-h-11 items-center border-b py-2">
        <span className="type-ui text-heading min-w-0 font-semibold break-words">
          {feature.name}
        </span>
      </li>
    );
  return (
    <li className="border-divider border-b py-2">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
        className="h-auto min-h-11 w-full flex-wrap justify-between gap-3 px-0 text-left whitespace-normal"
      >
        <span className="type-ui text-heading min-w-0 font-semibold break-words">
          {feature.name}
        </span>
        {feature.choice && (
          <span className="type-caption text-muted min-w-0 break-words">
            {selectedOption || 'Choose one'}
          </span>
        )}
        {expanded ? (
          <ChevronUp aria-hidden className="size-4 shrink-0" />
        ) : (
          <ChevronDown aria-hidden className="size-4 shrink-0" />
        )}
      </Button>
      {expanded && (
        <div className="space-y-3 pb-2">
          {feature.entries?.map((entry, index) => (
            <div
              key={`${feature.name}-entry-${index}`}
              className="type-body text-body break-words"
              dangerouslySetInnerHTML={{ __html: entry }}
            />
          ))}
          {feature.choice && (
            <RadioGroup
              value={selectedOption ?? ''}
              onValueChange={onOptionSelect}
              aria-label={feature.name}
              className="border-divider gap-0 border-t"
            >
              {feature.choice.options.map(option => (
                <div key={option.name}>
                  <WizardChoiceRow value={option.name} title={option.name} />
                  {option.entries.map((entry, index) => (
                    <div
                      key={`${option.name}-entry-${index}`}
                      className="type-caption text-muted pb-2 pl-3"
                      dangerouslySetInnerHTML={{ __html: entry }}
                    />
                  ))}
                </div>
              ))}
            </RadioGroup>
          )}
        </div>
      )}
    </li>
  );
}

export default function FeaturesSummaryStep({
  className,
  newLevel,
  features,
  subclassFeatures,
  subclassName,
  subclassSpellGrants,
  featureChoices,
  onFeatureChoiceChange,
}: FeaturesSummaryStepProps) {
  const displayFeatures = features.filter(
    f => f.name !== 'Ability Score Improvement' && f.name !== 'Epic Boon'
  );
  return (
    <div className="space-y-5">
      <div>
        <h3 className="type-subheading text-heading">
          New features at level {newLevel}
        </h3>
        <p className="type-body text-muted mt-1">
          Here&apos;s what your {className} gains.
        </p>
      </div>
      {displayFeatures.length > 0 && (
        <div>
          <h4 className="type-label-heading text-heading">Class features</h4>
          <ul className="border-divider mt-2 border-t">
            {displayFeatures.map(feature => (
              <FeatureRow
                key={`${feature.name}-${feature.level}`}
                feature={feature}
                selectedOption={featureChoices[feature.name]}
                onOptionSelect={name =>
                  onFeatureChoiceChange(feature.name, name)
                }
              />
            ))}
          </ul>
        </div>
      )}
      {subclassFeatures.length > 0 && (
        <div>
          <h4 className="type-label-heading text-heading">
            {subclassName || 'Subclass'} features
          </h4>
          <ul className="border-divider mt-2 border-t">
            {subclassFeatures.map(feature => (
              <FeatureRow
                key={`${feature.name}-${feature.level}`}
                feature={feature}
                selectedOption={featureChoices[feature.name]}
                onOptionSelect={name =>
                  onFeatureChoiceChange(feature.name, name)
                }
              />
            ))}
          </ul>
        </div>
      )}
      {subclassSpellGrants.length > 0 && (
        <div>
          <h4 className="type-label-heading text-heading">
            {subclassName || 'Subclass'} spells
          </h4>
          <ul className="divide-divider border-divider mt-2 divide-y border-t">
            {subclassSpellGrants.map(grant => (
              <li
                key={`${grant.spellName}-${grant.grantType}`}
                className="type-ui text-heading flex flex-wrap justify-between gap-2 py-2"
              >
                <span>{grant.spellName}</span>
                <span className="type-caption text-muted">
                  {grant.grantType === 'expanded'
                    ? 'Available'
                    : 'Always prepared'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
