'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
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
}

function FeatureCard({ feature }: { feature: ClassFeature }) {
  const [expanded, setExpanded] = useState(false);
  const hasDescription = feature.entries && feature.entries.length > 0;

  return (
    <div className="border-divider bg-surface-raised rounded-lg border">
      <button
        onClick={() => hasDescription && setExpanded(!expanded)}
        className={cn(
          'flex w-full items-center justify-between p-3 text-left',
          hasDescription && 'hover:bg-surface-secondary cursor-pointer'
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
        </div>
        {hasDescription &&
          (expanded ? (
            <ChevronUp size={14} className="text-muted" />
          ) : (
            <ChevronDown size={14} className="text-muted" />
          ))}
      </button>
      {expanded && hasDescription && (
        <div className="border-divider text-body border-t px-3 py-2 text-sm leading-relaxed">
          {feature.entries!.map((entry, i) => (
            <p
              key={i}
              className="mb-2 last:mb-0"
              dangerouslySetInnerHTML={{ __html: entry }}
            />
          ))}
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
            <FeatureCard key={`class-${i}`} feature={f} />
          ))}
        </div>
      )}

      {subclassFeatures.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-heading text-sm font-semibold">
            {subclassName || 'Subclass'} Features
          </h4>
          {subclassFeatures.map((f, i) => (
            <FeatureCard key={`sub-${i}`} feature={f} />
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
