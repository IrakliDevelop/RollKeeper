'use client';

import type { ActiveCondition, ActiveDisease } from '@/types/character';
import { SPELL_SOURCE_BOOKS } from '@/utils/constants';
import { createSafeHtml } from '@/utils/textFormatting';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Badge } from '@/components/ui/layout/badge';
import { Section } from '@/components/ui/layout/section';
import { Textarea } from '@/components/ui/forms/textarea';
import { Input } from '@/components/ui/forms/input';

interface ConditionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  condition?: ActiveCondition;
  disease?: ActiveDisease;
  onUpdateNotes?: (notes: string) => void;
  onUpdateOnsetTime?: (onsetTime: string) => void;
}

export default function ConditionDetailsModal({
  isOpen,
  onClose,
  condition,
  disease,
  onUpdateNotes,
  onUpdateOnsetTime,
}: ConditionDetailsModalProps) {
  if (!isOpen || (!condition && !disease)) return null;
  const item = condition ?? disease!;
  const kind = disease
    ? 'Disease'
    : condition?.kind === 'buff'
      ? 'Buff'
      : 'Condition';
  const source = SPELL_SOURCE_BOOKS[item.source] || item.source;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Badge
              variant={kind === 'Condition' ? 'warning' : 'neutral'}
              size="sm"
            >
              {kind}
            </Badge>
            {condition?.stackable && condition.count > 1 && (
              <Badge variant="warning" size="sm">
                Level {condition.count}
              </Badge>
            )}
            <span className="type-small text-muted">{source}</span>
            <span className="type-small text-muted">
              Applied {new Date(item.appliedAt).toLocaleDateString()}
            </span>
            {disease?.onsetTime && (
              <span className="type-small text-muted">
                Onset {new Date(disease.onsetTime).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="mt-6 space-y-6">
            <Section heading="Description" level={4}>
              <div
                className="type-body text-body whitespace-pre-wrap"
                dangerouslySetInnerHTML={createSafeHtml(item.description)}
              />
            </Section>
            {disease && (
              <Section heading="Onset" level={4}>
                <Input
                  type="datetime-local"
                  aria-label="Onset"
                  value={disease.onsetTime || ''}
                  onChange={event => onUpdateOnsetTime?.(event.target.value)}
                  helperText="When symptoms started"
                />
              </Section>
            )}
            <Section heading="Notes" level={4}>
              <Textarea
                aria-label="Notes"
                value={item.notes || ''}
                onChange={event => onUpdateNotes?.(event.target.value)}
                rows={4}
              />
            </Section>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
