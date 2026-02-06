'use client';

import React from 'react';
import { Book, Calendar, FileText, AlertTriangle, Shield } from 'lucide-react';
import { ActiveCondition, ActiveDisease } from '@/types/character';
import { SPELL_SOURCE_BOOKS } from '@/utils/constants';
import { createSafeHtml } from '@/utils/textFormatting';
import { Modal } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/layout/badge';
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

  const item = condition || disease;
  const isCondition = !!condition;
  const fullSourceName = SPELL_SOURCE_BOOKS[item!.source] || item!.source;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item!.name}
      size="lg"
      showCloseButton={true}
      closeOnBackdropClick={true}
    >
      {/* Enhanced Header with Icon and Metadata */}
      <div
        className={`-m-6 mb-6 border-b-2 p-6 ${
          isCondition
            ? 'border-accent-red-border from-accent-red-bg to-accent-orange-bg bg-linear-to-r'
            : 'border-accent-purple-border from-accent-purple-bg to-accent-purple-bg-strong bg-linear-to-r'
        }`}
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg ${
              isCondition ? 'bg-accent-red-bg' : 'bg-accent-purple-bg'
            }`}
          >
            {isCondition ? (
              <AlertTriangle className="text-accent-red-text-muted h-6 w-6" />
            ) : (
              <Shield className="text-accent-purple-text-muted h-6 w-6" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={isCondition ? 'danger' : 'primary'}
              size="md"
              className="tracking-wide uppercase"
            >
              {isCondition ? 'Condition' : 'Disease'}
            </Badge>
            {condition?.stackable && condition.count > 1 && (
              <Badge variant="warning" size="md">
                Level {condition.count}
              </Badge>
            )}
          </div>
        </div>

        <div className="text-body flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Book className="text-muted h-4 w-4" />
            <span className="font-semibold">{fullSourceName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="text-muted h-4 w-4" />
            <span>
              Applied: {new Date(item!.appliedAt).toLocaleDateString()}
            </span>
          </div>
          {disease?.onsetTime && (
            <div className="flex items-center gap-2">
              <FileText className="text-muted h-4 w-4" />
              <span>
                Onset: {new Date(disease.onsetTime).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Description */}
        <div>
          <h3 className="text-heading border-divider mb-3 border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
            Description
          </h3>
          <div className="border-divider bg-surface-raised rounded-lg border-2 p-4">
            <div
              className="text-body text-sm leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={createSafeHtml(item!.description)}
            />
          </div>
        </div>

        {/* Disease-specific fields */}
        {disease && (
          <div>
            <h3 className="text-heading border-divider mb-3 border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
              Onset Time
            </h3>
            <Input
              type="datetime-local"
              value={disease.onsetTime || ''}
              onChange={e => onUpdateOnsetTime?.(e.target.value)}
              helperText="When did the symptoms first appear?"
            />
          </div>
        )}

        {/* Notes Section */}
        <div>
          <h3 className="text-heading border-divider mb-3 border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
            Personal Notes
          </h3>
          <Textarea
            placeholder={`Add your notes about this ${isCondition ? 'condition' : 'disease'}...`}
            value={item!.notes || ''}
            onChange={e => onUpdateNotes?.(e.target.value)}
            rows={4}
          />
        </div>
      </div>
    </Modal>
  );
}
