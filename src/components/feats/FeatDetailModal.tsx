'use client';

import type { ProcessedFeat } from '@/utils/featDataLoader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@/components/ui/feedback/dialog-new';
import { Badge } from '@/components/ui/layout/badge';
import { Card, CardContent } from '@/components/ui/layout/card';
import { Zap, BookOpen, RefreshCw, Sparkles } from 'lucide-react';

interface FeatDetailModalProps {
  feat: ProcessedFeat | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function FeatDetailModal({
  feat,
  isOpen,
  onClose,
}: FeatDetailModalProps) {
  if (!feat) return null;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader className="pr-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-2xl sm:text-3xl">
                {feat.name}
              </DialogTitle>
              <DialogDescription className="text-muted text-base">
                {feat.source}
                {feat.page ? `, p. ${feat.page}` : ''}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 gap-2">
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
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Quick info cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {feat.prerequisites.length > 0 && (
                <Card variant="bordered" padding="sm">
                  <CardContent className="flex items-start gap-3 p-0">
                    <BookOpen
                      size={20}
                      className="text-accent-amber-text mt-0.5 shrink-0"
                    />
                    <div>
                      <div className="text-faint mb-1 text-xs font-semibold tracking-wider uppercase">
                        Prerequisites
                      </div>
                      <div className="text-heading text-sm font-medium">
                        {feat.prerequisites.join(', ')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {feat.abilityIncreases && (
                <Card variant="bordered" padding="sm">
                  <CardContent className="flex items-start gap-3 p-0">
                    <Zap
                      size={20}
                      className="text-accent-blue-text mt-0.5 shrink-0"
                    />
                    <div>
                      <div className="text-faint mb-1 text-xs font-semibold tracking-wider uppercase">
                        Ability Increase
                      </div>
                      <div className="text-heading text-sm font-medium">
                        {feat.abilityIncreases}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {feat.grantsSpells && (
                <Card variant="bordered" padding="sm">
                  <CardContent className="flex items-start gap-3 p-0">
                    <Sparkles
                      size={20}
                      className="text-accent-purple-text mt-0.5 shrink-0"
                    />
                    <div>
                      <div className="text-faint mb-1 text-xs font-semibold tracking-wider uppercase">
                        Spellcasting
                      </div>
                      <div className="text-heading text-sm font-medium">
                        Grants Spells
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {feat.repeatable && (
                <Card variant="bordered" padding="sm">
                  <CardContent className="flex items-start gap-3 p-0">
                    <RefreshCw
                      size={20}
                      className="text-accent-emerald-text mt-0.5 shrink-0"
                    />
                    <div>
                      <div className="text-faint mb-1 text-xs font-semibold tracking-wider uppercase">
                        Repeatable
                      </div>
                      <div className="text-heading text-sm font-medium">
                        Can be taken multiple times
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Description */}
            <div>
              <h3 className="text-accent-amber-text border-accent-amber-border mb-3 border-b pb-2 text-xl font-bold">
                Description
              </h3>
              <div className="text-body space-y-3 text-sm leading-relaxed whitespace-pre-line">
                {feat.description}
              </div>
            </div>

            {/* Tags */}
            {feat.tags.length > 0 && (
              <div className="border-divider border-t pt-4">
                <div className="flex flex-wrap gap-2">
                  {feat.tags.map(tag => (
                    <Badge key={tag} variant="neutral" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
