'use client';

import React, { useState } from 'react';
import { ExtendedFeature } from '@/types/character';
import { calculateTraitMaxUses } from '@/utils/calculations';
import { 
  Eye, 
  Edit3, 
  Trash2, 
  Zap, 
  Clock, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import FeatureModal from '@/components/ui/character/ExtendedFeatures/FeatureModal';
import { Button } from '@/components/ui/forms';

interface FeatureCardProps {
  feature: ExtendedFeature;
  characterLevel: number;
  onUpdate: (updates: Partial<ExtendedFeature>) => void;
  onDelete: () => void;
  onUse: () => void;
  readonly?: boolean;
  isDragging?: boolean;
}

export default function FeatureCard({
  feature,
  characterLevel,
  onUpdate,
  onDelete,
  onUse,
  readonly = false,
  isDragging = false,
}: FeatureCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view');

  const maxUses = calculateTraitMaxUses(feature, characterLevel);
  const usesRemaining = maxUses - feature.usedUses;
  const isExhausted = !feature.isPassive && usesRemaining <= 0;
  const hasUses = !feature.isPassive && maxUses > 0;

  const handleViewClick = () => {
    setModalMode('view');
    setIsModalOpen(true);
  };

  const handleEditClick = () => {
    setModalMode('edit');
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
        className={`group flex flex-col h-full min-h-[140px] rounded-lg border-2 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md ${
          isDragging ? 'opacity-50 scale-95' : ''
        } ${isExhausted ? 'border-red-200 bg-red-50' : 'border-gray-200 hover:border-indigo-300'}`}
      >
        {/* Feature Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 truncate text-sm leading-tight">
              {feature.name}
            </h4>
            {feature.sourceDetail && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded mt-1 inline-block">
                {feature.sourceDetail}
              </span>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
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
        <div className="flex-1 mb-3">
          {feature.description && (
            <p className="text-xs text-gray-600 line-clamp-3">
              {feature.description}
            </p>
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
                <span className="capitalize text-xs">{feature.restType}</span>
              </div>
            )}
          </div>
        </div>

        {/* Usage Progress Bar */}
        {hasUses && maxUses > 1 && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-1">
              <div
                className={`h-1 rounded-full transition-all duration-300 ${
                  isExhausted ? 'bg-red-500' : 
                  usesRemaining <= 1 ? 'bg-orange-500' : 'bg-green-500'
                }`}
                style={{ width: `${(usesRemaining / maxUses) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Feature Modal */}
      <FeatureModal
        feature={feature}
        isOpen={isModalOpen}
        mode={modalMode}
        characterLevel={characterLevel}
        onClose={() => setIsModalOpen(false)}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onUse={onUse}
        readonly={readonly}
      />
    </>
  );
}
