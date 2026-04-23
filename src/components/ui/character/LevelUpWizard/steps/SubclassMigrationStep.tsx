'use client';

import { Sparkles, BookOpen, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { ProcessedSubclass } from '@/types/classes';
import type {
  MissedSubclassFeature,
  SubclassSpellGrant,
} from '../LevelUpWizard.types';

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
    <div className="space-y-4">
      <div className="text-center">
        <div className="bg-accent-amber-bg text-accent-amber-text mx-auto mb-2 flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
          <AlertTriangle size={12} />
          Subclass not set
        </div>
        <h3 className="text-heading text-lg font-semibold">
          Choose your {className} subclass
        </h3>
        <p className="text-muted mt-1 text-sm">
          Your character is level {currentLevel} but has no subclass. Select one
          now to continue.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {subclasses.map(sc => {
          const isSelected = selectedSubclass?.id === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => onSelectSubclass(sc)}
              className={cn(
                'rounded-lg border p-3 text-left transition-all',
                isSelected
                  ? 'border-accent-purple-border bg-accent-purple-bg'
                  : 'border-divider bg-surface-raised hover:bg-surface-secondary'
              )}
            >
              <div className="flex items-start gap-2">
                <Sparkles
                  size={16}
                  className={cn(
                    'mt-0.5 flex-shrink-0',
                    isSelected ? 'text-accent-purple-text' : 'text-muted'
                  )}
                />
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      isSelected ? 'text-accent-purple-text' : 'text-heading'
                    )}
                  >
                    {sc.name}
                  </p>
                  <p className="text-faint mt-0.5 text-xs">{sc.source}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedSubclass && missedFeatures.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-heading text-sm font-semibold">
            Missed subclass features
          </h4>
          <p className="text-muted text-xs">
            These features were available at earlier levels. Toggle on any you
            haven&apos;t already added manually.
          </p>
          <div className="space-y-1">
            {missedFeatures.map(mf => {
              const key = `${mf.feature.name}-${mf.level}`;
              return (
                <button
                  key={key}
                  onClick={() => onToggleFeature(key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all',
                    mf.adopted
                      ? 'border-accent-emerald-border bg-accent-emerald-bg'
                      : 'border-divider bg-surface-raised hover:bg-surface-secondary'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border',
                      mf.adopted
                        ? 'border-accent-emerald-border bg-accent-emerald-bg'
                        : 'border-divider'
                    )}
                  >
                    {mf.adopted && (
                      <Check size={12} className="text-accent-emerald-text" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <BookOpen
                        size={12}
                        className="text-accent-amber-text flex-shrink-0"
                      />
                      <span
                        className={cn(
                          'text-sm font-medium',
                          mf.adopted
                            ? 'text-accent-emerald-text'
                            : 'text-heading'
                        )}
                      >
                        {mf.feature.name}
                      </span>
                      <span className="text-faint text-xs">Lv {mf.level}</span>
                    </div>
                    {mf.feature.entries && mf.feature.entries.length > 0 && (
                      <p
                        className="text-muted mt-0.5 line-clamp-2 text-xs"
                        dangerouslySetInnerHTML={{
                          __html: mf.feature.entries[0],
                        }}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedSubclass && missedSpellGrants.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-heading flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={14} className="text-accent-purple-text" />
            Missed subclass spells
          </h4>
          <p className="text-muted text-xs">
            These spells will be added automatically.
          </p>
          <div className="border-divider bg-surface-raised space-y-1 rounded-lg border p-3">
            {missedSpellGrants.map((grant, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-heading">{grant.spellName}</span>
                <span className="bg-accent-emerald-bg text-accent-emerald-text rounded-full px-2 py-0.5 text-xs font-medium">
                  Always Prepared
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
