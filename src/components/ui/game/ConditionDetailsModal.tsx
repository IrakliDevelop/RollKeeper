'use client';

import React from 'react';
import { Book, Calendar, FileText } from 'lucide-react';
import { ActiveCondition, ActiveDisease } from '@/types/character';
import { SPELL_SOURCE_BOOKS } from '@/utils/constants';
import { createSafeHtml } from '@/utils/textFormatting';
import { Modal } from '@/components/ui/feedback';

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
      <div className={`border-b p-6 ${isCondition ? 'bg-red-50' : 'bg-purple-50'}`}>
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`rounded-lg p-2 ${isCondition ? 'bg-red-100' : 'bg-purple-100'}`}
          >
            {isCondition ? (
              <span className="text-2xl text-red-600">⚠️</span>
            ) : (
              <span className="text-2xl text-purple-600">🦠</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium uppercase tracking-wide ${isCondition ? 'text-red-700' : 'text-purple-700'}`}>
              {isCondition ? 'Condition' : 'Disease'}
            </span>
            {condition?.stackable && condition.count > 1 && (
              <span
                className={`rounded-full px-3 py-1 text-sm font-bold ${isCondition ? 'bg-red-200 text-red-800' : 'bg-purple-200 text-purple-800'}`}
              >
                Level {condition.count}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
          <div className="flex items-center gap-1">
            <Book className="h-4 w-4" />
            <span className="font-medium">{fullSourceName}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>
              Applied:{' '}
              {new Date(item!.appliedAt).toLocaleDateString()}
            </span>
          </div>
          {disease?.onsetTime && (
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>
                Onset:{' '}
                {new Date(disease.onsetTime).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Description */}
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-800">
            <FileText className="h-5 w-5" />
            Description
          </h3>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div
              className="leading-relaxed whitespace-pre-wrap text-gray-800"
              dangerouslySetInnerHTML={createSafeHtml(item!.description)}
            />
          </div>
        </div>

        {/* Notes Section */}
        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-800">
            Personal Notes
          </h3>
          <textarea
            placeholder={`Add your notes about this ${isCondition ? 'condition' : 'disease'}...`}
            value={item!.notes || ''}
            onChange={e => onUpdateNotes?.(e.target.value)}
            className="w-full resize-none rounded-lg border border-gray-300 p-3 text-gray-800 placeholder:text-gray-600 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        </div>

        {/* Disease-specific fields */}
        {disease && (
          <div>
            <h3 className="mb-3 text-lg font-semibold text-gray-800">
              Onset Time
            </h3>
            <input
              type="datetime-local"
              value={disease.onsetTime || ''}
              onChange={e => onUpdateOnsetTime?.(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-3 text-gray-800 focus:border-transparent focus:ring-2 focus:ring-blue-500 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
            />
            <p className="mt-1 text-sm text-gray-600">
              When did the symptoms first appear?
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
