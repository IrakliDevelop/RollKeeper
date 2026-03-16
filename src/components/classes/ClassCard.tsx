'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ProcessedClass } from '@/types/classes';
import {
  formatSpellcastingType,
  formatSpellcastingAbility,
  formatProficiencyType,
} from '@/utils/classFilters';
import {
  Shield,
  Heart,
  Star,
  Users,
  ChevronDown,
  ChevronUp,
  Brain,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/layout/card';
import { Badge } from '@/components/ui/layout/badge';

interface ClassCardProps {
  classData: ProcessedClass;
  displayMode: 'grid' | 'list';
}

export default function ClassCard({ classData, displayMode }: ClassCardProps) {
  const [showSubclasses, setShowSubclasses] = useState(false);

  if (displayMode === 'list') {
    return (
      <Link href={`/classes/${classData.id}`} className="group block">
        <Card
          variant="bordered"
          padding="md"
          className="transition-all group-hover:shadow-md"
        >
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex items-center gap-3">
                  <Shield className="text-accent-emerald-text h-7 w-7 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-heading truncate text-xl font-bold">
                      {classData.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-muted text-sm">
                        {classData.source}
                      </span>
                      {classData.page && (
                        <span className="text-faint text-xs">
                          p. {classData.page}
                        </span>
                      )}
                      {classData.isSrd && (
                        <Badge variant="success" size="sm">
                          SRD
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="flex items-center gap-2">
                    <Heart className="text-accent-red-text h-4 w-4 shrink-0" />
                    <div>
                      <div className="text-faint text-xs">Hit Die</div>
                      <Badge variant="neutral" size="sm">
                        {classData.hitDie}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="text-accent-purple-text h-4 w-4 shrink-0" />
                    <div>
                      <div className="text-faint text-xs">Casting</div>
                      <Badge variant="neutral" size="sm">
                        {formatSpellcastingType(classData.spellcasting.type)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Brain className="text-accent-blue-text h-4 w-4 shrink-0" />
                    <div>
                      <div className="text-faint text-xs">Saves</div>
                      <span className="text-body text-sm">
                        {classData.primaryAbilities
                          ?.map(formatProficiencyType)
                          .join(', ') || 'None'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="text-accent-emerald-text h-4 w-4 shrink-0" />
                    <div>
                      <div className="text-faint text-xs">Subclasses</div>
                      <span className="text-heading text-sm font-medium">
                        {classData.subclasses.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {classData.subclasses.length > 0 && (
                <button
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowSubclasses(!showSubclasses);
                  }}
                  className="text-muted hover:text-accent-emerald-text min-h-[44px] min-w-[44px] p-2 transition-colors"
                  aria-label="Toggle subclasses"
                  aria-expanded={showSubclasses}
                >
                  {showSubclasses ? (
                    <ChevronUp size={20} />
                  ) : (
                    <ChevronDown size={20} />
                  )}
                </button>
              )}
            </div>

            {showSubclasses && classData.subclasses.length > 0 && (
              <div className="border-divider mt-4 border-t pt-4">
                <h4 className="text-body mb-3 flex items-center gap-2 text-sm font-medium">
                  <Users size={16} /> Subclasses ({classData.subclasses.length})
                </h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {classData.subclasses.map(subclass => (
                    <div
                      key={subclass.id}
                      className="bg-surface-secondary rounded-lg p-3"
                    >
                      <div className="text-heading text-sm font-medium">
                        {subclass.name}
                      </div>
                      <div className="text-faint text-xs">
                        {subclass.source}
                        {subclass.page && ` · p. ${subclass.page}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={`/classes/${classData.id}`} className="group block">
      <Card
        variant="bordered"
        padding="md"
        className="h-full transition-all group-hover:shadow-md"
      >
        <CardContent className="p-0">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="bg-accent-emerald-bg flex h-11 w-11 shrink-0 items-center justify-center rounded-lg">
                <Shield className="text-accent-emerald-text h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-heading truncate text-lg font-bold">
                  {classData.name}
                </h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-muted text-sm">{classData.source}</span>
                  {classData.page && (
                    <span className="text-faint text-xs">
                      p. {classData.page}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {classData.isSrd && (
              <Badge variant="success" size="sm">
                SRD
              </Badge>
            )}
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Heart className="text-accent-red-text h-4 w-4 shrink-0" />
              <div>
                <div className="text-faint text-xs">Hit Die</div>
                <Badge variant="neutral" size="sm">
                  {classData.hitDie}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Star className="text-accent-purple-text h-4 w-4 shrink-0" />
              <div>
                <div className="text-faint text-xs">Casting</div>
                <Badge variant="neutral" size="sm">
                  {formatSpellcastingType(classData.spellcasting.type)}
                </Badge>
              </div>
            </div>
          </div>

          {classData.primaryAbilities &&
            classData.primaryAbilities.length > 0 && (
              <div className="mb-4">
                <div className="text-faint mb-1 text-xs">Saving Throws</div>
                <div className="flex flex-wrap gap-1">
                  {classData.primaryAbilities.map(ability => (
                    <Badge key={ability} variant="info" size="sm">
                      {formatProficiencyType(ability)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

          {classData.spellcasting.ability && (
            <div className="mb-4">
              <div className="text-faint mb-1 text-xs">
                Spellcasting Ability
              </div>
              <span className="text-accent-emerald-text text-sm font-medium">
                {formatSpellcastingAbility(classData.spellcasting.ability)}
              </span>
            </div>
          )}

          {classData.subclasses.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-faint text-xs">
                  Subclasses ({classData.subclasses.length})
                </span>
                <button
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowSubclasses(!showSubclasses);
                  }}
                  className="text-accent-emerald-text flex min-h-[44px] items-center gap-1 text-xs"
                  aria-expanded={showSubclasses}
                >
                  {showSubclasses ? 'Hide' : 'Show'}
                  {showSubclasses ? (
                    <ChevronUp size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                </button>
              </div>
              {!showSubclasses ? (
                <div className="text-muted text-xs">
                  {classData.subclasses
                    .slice(0, 3)
                    .map(sub => sub.shortName)
                    .join(', ')}
                  {classData.subclasses.length > 3 &&
                    ` +${classData.subclasses.length - 3} more`}
                </div>
              ) : (
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {classData.subclasses.map(subclass => (
                    <div
                      key={subclass.id}
                      className="bg-surface-secondary rounded-lg p-2"
                    >
                      <div className="text-heading text-xs font-medium">
                        {subclass.name}
                      </div>
                      <div className="text-faint text-xs">
                        {subclass.source}
                        {subclass.page && ` · p. ${subclass.page}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
