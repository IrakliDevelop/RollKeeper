'use client';

import React from 'react';
import { X, Book, Calendar, FileText } from 'lucide-react';
import { ActiveCondition, ActiveDisease } from '@/types/character';
import { SPELL_SOURCE_BOOKS } from '@/utils/constants';
import { createSafeHtml } from '@/utils/textFormatting';

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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div
          className={`border-b p-6 ${isCondition ? 'border-red-200 bg-red-50' : 'border-purple-200 bg-purple-50'}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-3">
                <div
                  className={`rounded-lg p-2 ${isCondition ? 'bg-red-100' : 'bg-purple-100'}`}
                >
                  {isCondition ? (
                    <span className="text-xl text-red-600">⚠️</span>
                  ) : (
                    <span className="text-xl text-purple-600">🦠</span>
                  )}
                </div>
                <div>
                  <h2
                    className={`text-2xl font-bold ${isCondition ? 'text-red-800' : 'text-purple-800'}`}
                  >
                    {item!.name}
                    {condition?.stackable && condition.count > 1 && (
                      <span
                        className={`ml-2 rounded-full px-3 py-1 text-sm font-bold ${isCondition ? 'bg-red-200 text-red-800' : 'bg-purple-200 text-purple-800'}`}
                      >
                        Level {condition.count}
                      </span>
                    )}
                  </h2>
                  <div className="mt-1 flex items-center gap-4 text-sm text-gray-700">
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
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {/* Description */}
          <div className="mb-6">
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
          <div className="mb-4">
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
            <div className="mb-4">
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

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 p-6">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                isCondition
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
