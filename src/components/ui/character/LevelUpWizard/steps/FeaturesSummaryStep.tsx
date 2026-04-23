'use client';

import { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Check,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { ClassFeature } from '@/types/classes';
import type { SubclassSpellGrant } from '../LevelUpWizard.types';

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

function FeatureCard({
  feature,
  selectedOption,
  onOptionSelect,
}: {
  feature: ClassFeature;
  selectedOption?: string;
  onOptionSelect?: (optionName: string) => void;
}) {
  const [expanded, setExpanded] = useState(!!feature.choice);
  const hasDescription = feature.entries && feature.entries.length > 0;
  const hasChoice = !!feature.choice;

  return (
    <div className="border-divider bg-surface-raised rounded-lg border">
      <button
        onClick={() => (hasDescription || hasChoice) && setExpanded(!expanded)}
        className={cn(
          'flex w-full items-center justify-between p-3 text-left',
          (hasDescription || hasChoice) &&
            'hover:bg-surface-secondary cursor-pointer'
        )}
      >
        <div className="flex items-center gap-2">
          <BookOpen
            size={14}
            className="text-accent-amber-text flex-shrink-0"
          />
          <span className="text-heading text-sm font-medium">
            {feature.name}
          </span>
          {hasChoice && !selectedOption && (
            <span className="bg-accent-amber-bg text-accent-amber-text rounded-full px-2 py-0.5 text-xs font-medium">
              Choose one
            </span>
          )}
          {hasChoice && selectedOption && (
            <span className="bg-accent-emerald-bg text-accent-emerald-text rounded-full px-2 py-0.5 text-xs font-medium">
              {selectedOption}
            </span>
          )}
        </div>
        {(hasDescription || hasChoice) &&
          (expanded ? (
            <ChevronUp size={14} className="text-muted" />
          ) : (
            <ChevronDown size={14} className="text-muted" />
          ))}
      </button>
      {expanded && (
        <div className="border-divider border-t px-3 py-2">
          {hasDescription && (
            <div className="text-body text-sm leading-relaxed">
              {feature.entries!.map((entry, i) => (
                <p
                  key={i}
                  className="mb-2 last:mb-0"
                  dangerouslySetInnerHTML={{ __html: entry }}
                />
              ))}
            </div>
          )}
          {hasChoice && (
            <div className="mt-2 space-y-2">
              {feature.choice!.options.map(option => {
                const isSelected = selectedOption === option.name;
                return (
                  <button
                    key={option.name}
                    onClick={e => {
                      e.stopPropagation();
                      onOptionSelect?.(option.name);
                    }}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-all',
                      isSelected
                        ? 'border-accent-emerald-border bg-accent-emerald-bg'
                        : 'border-divider bg-surface hover:bg-surface-secondary'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border',
                          isSelected
                            ? 'border-accent-emerald-border bg-accent-emerald-bg'
                            : 'border-divider'
                        )}
                      >
                        {isSelected && (
                          <Check
                            size={12}
                            className="text-accent-emerald-text"
                          />
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isSelected
                            ? 'text-accent-emerald-text'
                            : 'text-heading'
                        )}
                      >
                        {option.name}
                      </span>
                    </div>
                    {option.entries.length > 0 && (
                      <div className="text-muted mt-1 pl-7 text-xs leading-relaxed">
                        {option.entries.map((entry, i) => (
                          <p
                            key={i}
                            className="mb-1 last:mb-0"
                            dangerouslySetInnerHTML={{ __html: entry }}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
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
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-heading text-lg font-semibold">
          New Features at Level {newLevel}
        </h3>
        <p className="text-muted mt-1 text-sm">
          Here&apos;s what your {className} gains.
        </p>
      </div>

      {displayFeatures.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-heading text-sm font-semibold">Class Features</h4>
          {displayFeatures.map((f, i) => (
            <FeatureCard
              key={`class-${i}`}
              feature={f}
              selectedOption={featureChoices[f.name]}
              onOptionSelect={name => onFeatureChoiceChange(f.name, name)}
            />
          ))}
        </div>
      )}

      {subclassFeatures.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-heading text-sm font-semibold">
            {subclassName || 'Subclass'} Features
          </h4>
          {subclassFeatures.map((f, i) => (
            <FeatureCard
              key={`sub-${i}`}
              feature={f}
              selectedOption={featureChoices[f.name]}
              onOptionSelect={name => onFeatureChoiceChange(f.name, name)}
            />
          ))}
        </div>
      )}

      {subclassSpellGrants.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-heading flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={14} className="text-accent-purple-text" />
            {subclassName || 'Subclass'} Spells
          </h4>
          <div className="border-divider bg-surface-raised space-y-1 rounded-lg border p-3">
            {subclassSpellGrants.map((grant, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-heading">{grant.spellName}</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    grant.grantType === 'expanded'
                      ? 'bg-surface-secondary text-muted'
                      : 'bg-accent-emerald-bg text-accent-emerald-text'
                  )}
                >
                  {grant.grantType === 'expanded'
                    ? 'Available'
                    : 'Always Prepared'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
