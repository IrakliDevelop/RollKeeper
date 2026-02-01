'use client';

import React, { useState } from 'react';
import { MagicItem, MagicItemCharge, MagicItemRarity } from '@/types/character';
import {
  Edit2,
  Trash2,
  Sparkles,
  Clock,
  Minus,
  Plus,
  Info,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { Modal } from '@/components/ui/feedback/Modal';
import { calculateMagicItemChargeMax } from '@/utils/calculations';

interface MagicItemCardProps {
  item: MagicItem;
  characterLevel: number;
  onEdit: (item: MagicItem) => void;
  onDelete: (id: string) => void;
  onToggleAttunement: (item: MagicItem, shouldAttune: boolean) => void;
  onExpendCharge: (itemId: string, chargeId: string) => void;
  onRestoreCharge: (itemId: string, chargeId: string) => void;
}

const getRarityVariant = (
  rarity: MagicItemRarity
): 'secondary' | 'success' | 'info' | 'primary' | 'warning' | 'danger' => {
  switch (rarity) {
    case 'common':
      return 'secondary';
    case 'uncommon':
      return 'success';
    case 'rare':
      return 'info';
    case 'very rare':
      return 'primary';
    case 'legendary':
      return 'warning';
    case 'artifact':
      return 'danger';
    default:
      return 'secondary';
  }
};

const getRestTypeIcon = (restType: 'short' | 'long' | 'dawn') => {
  if (restType === 'dawn') return <Sun size={10} />;
  return <Clock size={10} />;
};

const getRestTypeLabel = (restType: 'short' | 'long' | 'dawn') => {
  if (restType === 'dawn') return 'D';
  return restType[0].toUpperCase();
};

export function MagicItemCard({
  item,
  characterLevel,
  onEdit,
  onDelete,
  onToggleAttunement,
  onExpendCharge,
  onRestoreCharge,
}: MagicItemCardProps) {
  // State for charge detail modal
  const [selectedCharge, setSelectedCharge] = useState<MagicItemCharge | null>(
    null
  );

  const hasCharges = item.charges && item.charges.length > 0;

  return (
    <>
      <div
        className={`rounded-lg border-2 p-4 transition-all hover:shadow-md ${
          item.isEquipped
            ? 'border-purple-300 bg-white'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h4 className="font-bold text-gray-800">{item.name}</h4>
              <Badge variant={getRarityVariant(item.rarity)} size="sm">
                {item.rarity}
              </Badge>
              {item.requiresAttunement && (
                <Badge
                  variant={item.isAttuned ? 'primary' : 'secondary'}
                  size="sm"
                >
                  {item.isAttuned ? 'Attuned' : 'Requires Attunement'}
                </Badge>
              )}
            </div>

            <div className="mb-2 text-sm text-gray-600 capitalize">
              {item.category}
            </div>

            <p className="mb-2 text-sm text-gray-700">{item.description}</p>

            {/* Charges display - compact with +/- controls */}
            {hasCharges && (
              <div className="mb-2 flex flex-wrap gap-2">
                {item.charges!.map(charge => {
                  const maxCharges = calculateMagicItemChargeMax(
                    charge,
                    characterLevel
                  );
                  const usedCharges = charge.usedCharges || 0;
                  const chargesRemaining = maxCharges - usedCharges;
                  const isExhausted = chargesRemaining <= 0;
                  const isFull = usedCharges <= 0;

                  return (
                    <div
                      key={charge.id}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${
                        isExhausted
                          ? 'border-red-200 bg-red-50'
                          : 'border-purple-200 bg-purple-50'
                      }`}
                    >
                      {/* Clickable name to open details */}
                      <button
                        onClick={() => setSelectedCharge(charge)}
                        className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
                        title="Click for details"
                      >
                        <Sparkles
                          size={12}
                          className={
                            isExhausted ? 'text-red-500' : 'text-purple-600'
                          }
                        />
                        <span className="max-w-[120px] truncate text-xs font-medium text-gray-800">
                          {charge.name || 'Ability'}
                        </span>
                      </button>

                      {/* Charges counter with +/- buttons */}
                      <div className="ml-1 flex items-center gap-0.5">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onRestoreCharge(item.id, charge.id);
                          }}
                          disabled={isFull}
                          className={`rounded p-0.5 ${
                            isFull
                              ? 'cursor-not-allowed text-gray-300'
                              : 'text-green-600 hover:bg-green-100'
                          }`}
                          title="Restore charge"
                        >
                          <Plus size={12} />
                        </button>
                        <span
                          className={`min-w-[28px] text-center text-xs font-bold ${
                            isExhausted
                              ? 'text-red-600'
                              : chargesRemaining <= 1
                                ? 'text-orange-600'
                                : 'text-purple-600'
                          }`}
                        >
                          {chargesRemaining}/{maxCharges}
                        </span>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onExpendCharge(item.id, charge.id);
                          }}
                          disabled={isExhausted}
                          className={`rounded p-0.5 ${
                            isExhausted
                              ? 'cursor-not-allowed text-gray-300'
                              : 'text-red-600 hover:bg-red-100'
                          }`}
                          title="Use charge"
                        >
                          <Minus size={12} />
                        </button>
                      </div>

                      {/* Rest type indicator */}
                      <div className="ml-1 flex items-center gap-0.5 text-[10px] text-gray-500">
                        {getRestTypeIcon(charge.restType)}
                        <span>{getRestTypeLabel(charge.restType)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legacy charges display */}
            {item.legacyCharges && (
              <Badge variant="info" size="sm">
                Charges: {item.legacyCharges.current}/{item.legacyCharges.max}
              </Badge>
            )}
          </div>

          <div className="ml-4 flex flex-col gap-2">
            <div className="flex gap-1">
              <Button
                onClick={() => onEdit(item)}
                variant="ghost"
                size="xs"
                title="Edit item"
                className="text-blue-600 hover:bg-blue-50 hover:text-blue-800"
              >
                <Edit2 size={16} />
              </Button>
              <Button
                onClick={() => onDelete(item.id)}
                variant="ghost"
                size="xs"
                title="Delete item"
                className="text-red-600 hover:bg-red-50 hover:text-red-800"
              >
                <Trash2 size={16} />
              </Button>
            </div>
            {item.requiresAttunement && (
              <Button
                onClick={() => onToggleAttunement(item, !item.isAttuned)}
                variant={item.isAttuned ? 'primary' : 'outline'}
                size="sm"
                className={
                  item.isAttuned
                    ? 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700'
                    : 'hover:border-purple-300 hover:bg-purple-50'
                }
              >
                {item.isAttuned ? 'Unattune' : 'Attune'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Charge Detail Modal */}
      {selectedCharge && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCharge(null)}
          title={selectedCharge.name || 'Charge Ability'}
          size="sm"
        >
          <div className="space-y-4">
            {/* Item name */}
            <div className="text-sm text-gray-500">
              From:{' '}
              <span className="font-medium text-gray-700">{item.name}</span>
            </div>

            {/* Description */}
            {selectedCharge.description ? (
              <div className="prose prose-sm max-w-none">
                <div
                  dangerouslySetInnerHTML={{
                    __html: selectedCharge.description,
                  }}
                  className="text-gray-700"
                />
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No description provided.
              </p>
            )}

            {/* Charges info */}
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Charges
                </span>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  {getRestTypeIcon(selectedCharge.restType)}
                  <span className="capitalize">
                    Recharges{' '}
                    {selectedCharge.restType === 'dawn'
                      ? 'at dawn'
                      : `on ${selectedCharge.restType} rest`}
                  </span>
                </div>
              </div>

              {/* Charge adjustment controls */}
              {(() => {
                const maxCharges = calculateMagicItemChargeMax(
                  selectedCharge,
                  characterLevel
                );
                const usedCharges = selectedCharge.usedCharges || 0;
                const chargesRemaining = maxCharges - usedCharges;
                const isExhausted = chargesRemaining <= 0;
                const isFull = usedCharges <= 0;

                return (
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      onClick={() => {
                        onRestoreCharge(item.id, selectedCharge.id);
                        // Update local state
                        setSelectedCharge(prev =>
                          prev
                            ? {
                                ...prev,
                                usedCharges: Math.max(
                                  0,
                                  (prev.usedCharges || 0) - 1
                                ),
                              }
                            : null
                        );
                      }}
                      variant="outline"
                      size="sm"
                      disabled={isFull}
                      leftIcon={<Plus size={14} />}
                      className="border-green-300 text-green-600 hover:bg-green-50"
                    >
                      Restore
                    </Button>

                    <div className="text-center">
                      <span
                        className={`text-2xl font-bold ${
                          isExhausted
                            ? 'text-red-600'
                            : chargesRemaining <= 1
                              ? 'text-orange-600'
                              : 'text-purple-600'
                        }`}
                      >
                        {chargesRemaining}
                      </span>
                      <span className="text-lg text-gray-500">
                        /{maxCharges}
                      </span>
                    </div>

                    <Button
                      onClick={() => {
                        onExpendCharge(item.id, selectedCharge.id);
                        // Update local state
                        const max = calculateMagicItemChargeMax(
                          selectedCharge,
                          characterLevel
                        );
                        setSelectedCharge(prev =>
                          prev
                            ? {
                                ...prev,
                                usedCharges: Math.min(
                                  max,
                                  (prev.usedCharges || 0) + 1
                                ),
                              }
                            : null
                        );
                      }}
                      variant="outline"
                      size="sm"
                      disabled={isExhausted}
                      leftIcon={<Minus size={14} />}
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      Use
                    </Button>
                  </div>
                );
              })()}

              {/* Progress bar */}
              {(() => {
                const maxCharges = calculateMagicItemChargeMax(
                  selectedCharge,
                  characterLevel
                );
                const chargesRemaining =
                  maxCharges - (selectedCharge.usedCharges || 0);
                const isExhausted = chargesRemaining <= 0;

                return maxCharges > 1 ? (
                  <div className="mt-3 h-2 w-full rounded-full bg-gray-200">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isExhausted
                          ? 'bg-red-500'
                          : chargesRemaining <= 1
                            ? 'bg-orange-500'
                            : 'bg-purple-500'
                      }`}
                      style={{
                        width: `${(chargesRemaining / maxCharges) * 100}%`,
                      }}
                    />
                  </div>
                ) : null;
              })()}
            </div>

            {/* Proficiency scaling info */}
            {selectedCharge.scaleWithProficiency && (
              <p className="text-xs text-gray-500">
                <Info size={12} className="mr-1 inline" />
                Scales with proficiency bonus (×
                {selectedCharge.proficiencyMultiplier || 1})
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
