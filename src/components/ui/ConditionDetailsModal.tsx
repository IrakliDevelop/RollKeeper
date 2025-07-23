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
  onUpdateOnsetTime
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
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className={`p-6 border-b ${isCondition ? 'bg-red-50 border-red-200' : 'bg-purple-50 border-purple-200'}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${isCondition ? 'bg-red-100' : 'bg-purple-100'}`}>
                  {isCondition ? (
                    <span className="text-red-600 text-xl">⚠️</span>
                  ) : (
                    <span className="text-purple-600 text-xl">🦠</span>
                  )}
                </div>
                <div>
                  <h2 className={`text-2xl font-bold ${isCondition ? 'text-red-800' : 'text-purple-800'}`}>
                    {item!.name}
                    {condition?.stackable && condition.count > 1 && (
                      <span className={`ml-2 px-3 py-1 rounded-full text-sm font-bold ${isCondition ? 'bg-red-200 text-red-800' : 'bg-purple-200 text-purple-800'}`}>
                        Level {condition.count}
                      </span>
                    )}
                  </h2>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-700">
                    <div className="flex items-center gap-1">
                      <Book className="w-4 h-4" />
                      <span className="font-medium">{fullSourceName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Applied: {new Date(item!.appliedAt).toLocaleDateString()}</span>
                    </div>
                    {disease?.onsetTime && (
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        <span>Onset: {new Date(disease.onsetTime).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Description */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Description
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div 
                className="text-gray-800 leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={createSafeHtml(item!.description)}
              />
            </div>
          </div>

          {/* Notes Section */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Personal Notes
            </h3>
            <textarea
              placeholder={`Add your notes about this ${isCondition ? 'condition' : 'disease'}...`}
              value={item!.notes || ''}
              onChange={(e) => onUpdateNotes?.(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder:text-gray-600 resize-none"
              rows={3}
            />
          </div>

          {/* Disease-specific fields */}
          {disease && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Onset Time
              </h3>
              <input
                type="datetime-local"
                value={disease.onsetTime || ''}
                onChange={(e) => onUpdateOnsetTime?.(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
              <p className="text-sm text-gray-600 mt-1">
                When did the symptoms first appear?
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isCondition 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
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