'use client';

import React, { useState } from 'react';
import { ExtendedFeature, CharacterState } from '@/types/character';
import { calculateTraitMaxUses } from '@/utils/calculations';
import {
  Eye,
  Edit3,
  Trash2,
  Zap,
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import UnifiedFeatureModal from '@/components/ui/character/ExtendedFeatures/UnifiedFeatureModal';
import { Button } from '@/components/ui/forms';

interface FeatureCardProps {
  feature: ExtendedFeature;
  character: CharacterState;
  onUpdate: (updates: Partial<ExtendedFeature>) => void;
  onDelete: () => void;
  onUse: () => void;
  readonly?: boolean;
  isDragging?: boolean;
}

export default function FeatureCard({
  feature,
  character,
  onUpdate,
  onDelete,
  onUse,
  readonly = false,
  isDragging = false,
}: FeatureCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const maxUses = calculateTraitMaxUses(feature, character.level);
  const usesRemaining = maxUses - feature.usedUses;
  const isExhausted = !feature.isPassive && usesRemaining <= 0;
  const hasUses = !feature.isPassive && maxUses > 0;

  const handleViewClick = () => {
    setIsModalOpen(true);
  };

  const handleEditClick = () => {
    setIsModalOpen(true);
  };

  const getUsageColor = () => {
    if (feature.isPassive) return 'text-blue-600';
    if (isExhausted) return 'text-red-600';
    if (usesRemaining <= 1) return 'text-orange-600';
    return 'text-green-600';
  };

  const getUsageIcon = () => {
    if (feature.isPassive) return <CheckCircle2 className="h-4 w-4" />;
    if (isExhausted) return <AlertCircle className="h-4 w-4" />;
    return <Zap className="h-4 w-4" />;
  };

  return (
    <>
      <div
        className={`group flex h-full min-h-[140px] flex-col rounded-lg border-2 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md ${
          isDragging ? 'scale-95 opacity-50' : ''
        } ${isExhausted ? 'border-red-200 bg-red-50' : 'border-gray-200 hover:border-indigo-300'}`}
      >
        {/* Feature Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm leading-tight font-semibold text-gray-900">
              {feature.name}
            </h4>
            {feature.sourceDetail && (
              <span className="mt-1 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {feature.sourceDetail}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {/* Use Button */}
            {!readonly && hasUses && !isExhausted && (
              <Button
                onClick={onUse}
                variant="ghost"
                size="xs"
                className="text-indigo-600 hover:bg-indigo-100"
                title="Use feature"
              >
                <Zap className="h-5 w-5" />
              </Button>
            )}

            {/* View Button */}
            <Button
              onClick={handleViewClick}
              variant="ghost"
              size="xs"
              className="text-gray-600 hover:bg-gray-100"
              title="View details"
            >
              <Eye className="h-5 w-5" />
            </Button>

            {/* Edit Button */}
            {!readonly && (
              <Button
                onClick={handleEditClick}
                variant="ghost"
                size="xs"
                className="text-blue-600 hover:bg-blue-100"
                title="Edit feature"
              >
                <Edit3 className="h-5 w-5" />
              </Button>
            )}

            {/* Delete Button */}
            {!readonly && (
              <Button
                onClick={onDelete}
                variant="ghost"
                size="xs"
                className="text-red-600 hover:bg-red-100"
                title="Delete feature"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mb-3 flex-1">
          {feature.description && (
            <div
              className="line-clamp-3 text-xs text-gray-600"
              dangerouslySetInnerHTML={{ __html: feature.description }}
            />
          )}
        </div>

        {/* Usage Info */}
        <div className="mt-auto">
          <div className="flex items-center justify-between text-xs">
            <div className={`flex items-center gap-1 ${getUsageColor()}`}>
              {getUsageIcon()}
              {feature.isPassive ? (
                <span>Passive</span>
              ) : hasUses ? (
                <span>
                  {usesRemaining}/{maxUses}
                </span>
              ) : (
                <span>Unlimited</span>
              )}
            </div>

            {hasUses && (
              <div className="flex items-center gap-1 text-gray-500">
                <Clock className="h-3 w-3" />
                <span className="text-xs capitalize">{feature.restType}</span>
              </div>
            )}
          </div>
        </div>

        {/* Usage Progress Bar */}
        {hasUses && maxUses > 1 && (
          <div className="mt-2">
            <div className="h-1 w-full rounded-full bg-gray-200">
              <div
                className={`h-1 rounded-full transition-all duration-300 ${
                  isExhausted
                    ? 'bg-red-500'
                    : usesRemaining <= 1
                      ? 'bg-orange-500'
                      : 'bg-green-500'
                }`}
                style={{ width: `${(usesRemaining / maxUses) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Feature Modal */}
      <UnifiedFeatureModal
        feature={feature}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={onUpdate}
        onDelete={onDelete}
        onUse={onUse}
        existingFeatures={[]}
        character={character}
        readonly={readonly}
      />
    </>
  );
}
