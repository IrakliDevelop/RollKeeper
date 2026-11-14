'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@/components/ui/feedback/dialog';
import { Section } from '@/components/ui/layout/section';
import RichTextRenderer from '@/components/ui/utils/RichTextRenderer';
import { calculateTraitMaxUses } from '@/utils/calculations';
import { ExtendedFeature, FEATURE_SOURCE_LABELS } from '@/types/character';

interface FeatureModalProps {
  feature: ExtendedFeature;
  isOpen: boolean;
  characterLevel: number;
  onClose: () => void;
}

export default function FeatureModal({
  feature,
  isOpen,
  characterLevel,
  onClose,
}: FeatureModalProps) {
  const maxUses = calculateTraitMaxUses(feature, characterLevel);
  const usesRemaining = maxUses - feature.usedUses;
  const hasUses = !feature.isPassive && maxUses > 0;

  const source = FEATURE_SOURCE_LABELS[feature.sourceType];

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{feature.name}</DialogTitle>
          <DialogDescription className="type-small text-muted">
            {feature.sourceDetail
              ? `${source} · ${feature.sourceDetail}`
              : source}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-6">
            <Section heading="Usage information" level={3}>
              <div className="flex items-center justify-between">
                <div>
                  {feature.isPassive ? (
                    <div className="flex items-center gap-2">
                      <p className="text-muted text-sm font-medium">
                        Passive ability - always active
                      </p>
                    </div>
                  ) : hasUses ? (
                    <div className="flex items-center gap-2">
                      <p className="text-body text-sm font-medium">
                        <span className="text-heading">{usesRemaining}</span> of{' '}
                        {maxUses} uses remaining
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-muted text-sm font-medium">
                        Unlimited uses
                      </p>
                    </div>
                  )}
                </div>
                {hasUses && (
                  <div className="text-muted flex items-center gap-2 text-sm">
                    <Clock size={16} aria-hidden />
                    <span>Recharges on a {feature.restType} rest</span>
                  </div>
                )}
              </div>
            </Section>

            {feature.description && (
              <Section
                heading="Description"
                level={3}
                contentClassName="type-body text-body break-words"
              >
                <RichTextRenderer content={feature.description} />
              </Section>
            )}

            {(feature.scaleWithProficiency || feature.category) && (
              <Section heading="Additional details" level={3}>
                <dl className="type-small space-y-1">
                  {feature.scaleWithProficiency && (
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="text-muted">Scaling</dt>
                      <dd className="text-body">
                        Proficiency bonus × {feature.proficiencyMultiplier || 1}
                      </dd>
                    </div>
                  )}
                  {feature.category && (
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="text-muted">Category</dt>
                      <dd className="text-body">{feature.category}</dd>
                    </div>
                  )}
                </dl>
              </Section>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
