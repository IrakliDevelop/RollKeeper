'use client';

import React, { useState } from 'react';
import type { ProcessedFeat } from '@/utils/featDataLoader';
import { Zap, BookOpen, Sparkles, Scroll } from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';
import { Card } from '@/components/ui/layout/card';
import FeatDetailModal from './FeatDetailModal';

interface FeatCardProps {
  feat: ProcessedFeat;
  displayMode: 'grid' | 'list';
}

export default function FeatCard({ feat, displayMode }: FeatCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (displayMode === 'list') {
    return (
      <>
        <Card
          variant="bordered"
          padding="md"
          interactive
          onClick={() => setIsModalOpen(true)}
          className="cursor-pointer transition-all hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-heading text-lg font-semibold">
                  {feat.name}
                </h3>
                {feat.isSrd && (
                  <Badge variant="success" size="sm">
                    SRD
                  </Badge>
                )}
                {feat.repeatable && (
                  <Badge variant="info" size="sm">
                    Repeatable
                  </Badge>
                )}
                {feat.grantsSpells && (
                  <Badge variant="secondary" size="sm">
                    Grants Spells
                  </Badge>
                )}
              </div>

              <div className="text-muted mb-2 flex flex-wrap items-center gap-3 text-sm">
                <span>{feat.source}</span>
                {feat.prerequisites.length > 0 && (
                  <span className="flex items-center gap-1">
                    <BookOpen size={14} />
                    {feat.prerequisites.join(', ')}
                  </span>
                )}
                {feat.abilityIncreases && (
                  <span className="flex items-center gap-1">
                    <Zap size={14} />
                    {feat.abilityIncreases}
                  </span>
                )}
              </div>

              <p className="text-body line-clamp-2 text-sm leading-relaxed">
                {feat.description.substring(0, 200)}
                {feat.description.length > 200 && '...'}
              </p>
            </div>
          </div>
        </Card>

        <FeatDetailModal
          feat={feat}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <Card
        variant="bordered"
        padding="md"
        interactive
        onClick={() => setIsModalOpen(true)}
        className="flex h-full cursor-pointer flex-col transition-all hover:shadow-md"
      >
        <div className="mb-3 flex items-start justify-between">
          <div className="bg-accent-amber-bg flex h-10 w-10 items-center justify-center rounded-lg">
            <Scroll className="text-accent-amber-text h-5 w-5" />
          </div>
          <div className="flex gap-1">
            {feat.isSrd && (
              <Badge variant="success" size="sm">
                SRD
              </Badge>
            )}
            {feat.repeatable && (
              <Badge variant="info" size="sm">
                Repeatable
              </Badge>
            )}
          </div>
        </div>

        <h3 className="text-heading mb-2 text-lg leading-tight font-bold">
          {feat.name}
        </h3>

        <div className="mb-2">
          <span className="bg-accent-amber-bg text-accent-amber-text rounded-full px-2 py-1 text-xs font-medium">
            {feat.source}
          </span>
        </div>

        <div className="mb-3 flex flex-wrap gap-1">
          {feat.grantsSpells && (
            <Badge variant="secondary" size="sm">
              <Sparkles size={12} className="mr-1" /> Spells
            </Badge>
          )}
          {feat.abilityIncreases && (
            <Badge variant="info" size="sm">
              <Zap size={12} className="mr-1" /> ASI
            </Badge>
          )}
        </div>

        {feat.prerequisites.length > 0 && (
          <div className="text-muted mb-3 flex items-start gap-1.5 text-xs">
            <BookOpen size={14} className="mt-0.5 shrink-0" />
            <span>{feat.prerequisites.join(', ')}</span>
          </div>
        )}

        <p className="text-body mb-4 line-clamp-3 flex-1 text-sm leading-relaxed">
          {feat.description.substring(0, 150)}
          {feat.description.length > 150 && '...'}
        </p>
      </Card>

      <FeatDetailModal
        feat={feat}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
