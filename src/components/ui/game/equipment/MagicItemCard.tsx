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
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/feedback/dialog';
import { calculateMagicItemChargeMax } from '@/utils/calculations';

interface MagicItemCardProps {
  item: MagicItem;
  characterLevel: number;
  onEdit: (item: MagicItem) => void;
  onDelete: (id: string) => void;
  onToggleAttunement: (item: MagicItem, shouldAttune: boolean) => void;
  onExpendCharge: (itemId: string, chargeId: string) => void;
  onRestoreCharge: (itemId: string, chargeId: string) => void;
  onExpendChargePoolAbility?: (itemId: string, abilityId: string) => void;
  onRestoreChargePool?: (itemId: string, amount: number) => void;
  onSetChargePoolUsed?: (itemId: string, usedCount: number) => void;
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
  onExpendChargePoolAbility,
  onRestoreChargePool,
  onSetChargePoolUsed,
}: MagicItemCardProps) {
  const [selectedCharge, setSelectedCharge] = useState<MagicItemCharge | null>(
    null
  );
  const [localPoolUsed, setLocalPoolUsed] = useState<number | null>(null);

  const hasCharges = item.charges && item.charges.length > 0;
  const hasPool = !!item.chargePool;
  const poolUsed = localPoolUsed ?? item.chargePool?.usedCharges ?? 0;
  const poolMax = item.chargePool?.maxCharges ?? 0;
  const poolRemaining = poolMax - poolUsed;

  return (
    <>
      <div
        className={`rounded-lg border-2 p-4 transition-all hover:shadow-md ${
          item.isEquipped
            ? 'border-accent-purple-border-strong bg-surface-raised'
            : 'border-divider bg-surface-raised hover:border-divider-strong'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h4 className="text-heading font-bold">{item.name}</h4>
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

            <div className="text-muted mb-2 text-sm capitalize">
              {item.category}
            </div>

            <p className="text-body mb-2 text-sm">{item.description}</p>

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
                          ? 'border-accent-red-border bg-accent-red-bg'
                          : 'border-accent-purple-border bg-accent-purple-bg'
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
                            isExhausted
                              ? 'text-accent-red-text-muted'
                              : 'text-accent-purple-text-muted'
                          }
                        />
                        <span className="text-heading max-w-[120px] truncate text-xs font-medium">
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
                              ? 'text-faint cursor-not-allowed'
                              : 'text-accent-green-text-muted hover:bg-accent-green-bg'
                          }`}
                          title="Restore charge"
                        >
                          <Plus size={12} />
                        </button>
                        <span
                          className={`min-w-[28px] text-center text-xs font-bold ${
                            isExhausted
                              ? 'text-accent-red-text-muted'
                              : chargesRemaining <= 1
                                ? 'text-accent-orange-text-muted'
                                : 'text-accent-purple-text-muted'
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
                              ? 'text-faint cursor-not-allowed'
                              : 'text-accent-red-text-muted hover:bg-accent-red-bg'
                          }`}
                          title="Use charge"
                        >
                          <Minus size={12} />
                        </button>
                      </div>

                      {/* Rest type indicator */}
                      <div className="text-muted ml-1 flex items-center gap-0.5 text-[10px]">
                        {getRestTypeIcon(charge.restType)}
                        <span>{getRestTypeLabel(charge.restType)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Shared Charge Pool */}
            {hasPool && item.chargePool && (
              <div className="border-accent-amber-border bg-accent-amber-bg mb-2 rounded-lg border p-3">
                {/* Pool header with total charges */}
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-accent-amber-text" />
                    <span className="text-heading text-xs font-bold tracking-wider uppercase">
                      Charges
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (poolUsed <= 0) return;
                        const newUsed = poolUsed - 1;
                        setLocalPoolUsed(newUsed);
                        onRestoreChargePool?.(item.id, 1);
                      }}
                      disabled={poolUsed <= 0}
                      className={`rounded p-0.5 ${
                        poolUsed <= 0
                          ? 'text-faint cursor-not-allowed'
                          : 'text-accent-green-text-muted hover:bg-accent-green-bg'
                      }`}
                      title="Restore 1 charge"
                    >
                      <Plus size={14} />
                    </button>
                    <span
                      className={`min-w-[36px] text-center text-sm font-bold ${
                        poolRemaining <= 0
                          ? 'text-accent-red-text-muted'
                          : poolRemaining <= Math.ceil(poolMax * 0.25)
                            ? 'text-accent-orange-text-muted'
                            : 'text-accent-amber-text'
                      }`}
                    >
                      {poolRemaining}/{poolMax}
                    </span>
                    <button
                      onClick={() => {
                        if (poolRemaining <= 0) return;
                        const newUsed = poolUsed + 1;
                        setLocalPoolUsed(newUsed);
                        onSetChargePoolUsed?.(item.id, newUsed);
                      }}
                      disabled={poolRemaining <= 0}
                      className={`rounded p-0.5 ${
                        poolRemaining <= 0
                          ? 'text-faint cursor-not-allowed'
                          : 'text-accent-red-text-muted hover:bg-accent-red-bg'
                      }`}
                      title="Use 1 charge"
                    >
                      <Minus size={14} />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {poolMax > 0 && (
                  <div className="bg-surface-hover mb-2 h-1.5 w-full rounded-full">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        poolRemaining <= 0
                          ? 'bg-accent-red-bg-strong'
                          : poolRemaining <= Math.ceil(poolMax * 0.25)
                            ? 'bg-accent-orange-bg-strong'
                            : 'bg-accent-amber-bg-strong'
                      }`}
                      style={{
                        width: `${poolMax > 0 ? (poolRemaining / poolMax) * 100 : 0}%`,
                      }}
                    />
                  </div>
                )}

                {/* Recharge info */}
                <div className="text-muted mb-2 text-[10px]">
                  Regains {item.chargePool.rechargeAmount || 'all charges'} at{' '}
                  {item.chargePool.rechargeType === 'dawn'
                    ? 'dawn'
                    : item.chargePool.rechargeType === 'dusk'
                      ? 'dusk'
                      : item.chargePool.rechargeType === 'midnight'
                        ? 'midnight'
                        : item.chargePool.rechargeType === 'short'
                          ? 'short rest'
                          : item.chargePool.rechargeType === 'long'
                            ? 'long rest'
                            : item.chargePool.rechargeType}
                </div>

                {/* Abilities list */}
                <div className="space-y-1">
                  {item.chargePool.abilities.map(ability => {
                    const canUse =
                      ability.cost === 0 || ability.cost <= poolRemaining;

                    return (
                      <div
                        key={ability.id}
                        className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-xs ${
                          canUse
                            ? 'bg-surface-raised'
                            : 'bg-surface-inset opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          {ability.isSpell && (
                            <Sparkles
                              size={10}
                              className="text-accent-purple-text-muted shrink-0"
                            />
                          )}
                          <span className="text-heading truncate font-medium">
                            {ability.name}
                          </span>
                          {ability.description && (
                            <span className="text-faint shrink-0 text-[10px]">
                              ({ability.description})
                            </span>
                          )}
                        </div>
                        {ability.cost > 0 ? (
                          <button
                            onClick={() => {
                              if (!canUse) return;
                              const newUsed = poolUsed + ability.cost;
                              setLocalPoolUsed(newUsed);
                              onExpendChargePoolAbility?.(item.id, ability.id);
                            }}
                            disabled={!canUse}
                            className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold transition-colors ${
                              canUse
                                ? 'bg-accent-amber-bg-strong text-accent-amber-text hover:bg-accent-amber-border cursor-pointer'
                                : 'text-faint cursor-not-allowed'
                            }`}
                            title={`Use ${ability.cost} charge${ability.cost !== 1 ? 's' : ''}`}
                          >
                            {ability.cost} {ability.cost === 1 ? 'chg' : 'chg'}
                          </button>
                        ) : (
                          <Badge variant="success" size="sm">
                            {ability.description === 'Ritual only'
                              ? 'Ritual'
                              : 'Free'}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Spell bonus indicators */}
            {(item.bonusSpellAttack || item.bonusSpellSaveDc) && (
              <div className="mb-2 flex gap-2">
                {item.bonusSpellAttack && (
                  <Badge variant="info" size="sm">
                    +{item.bonusSpellAttack} Spell Attack
                  </Badge>
                )}
                {item.bonusSpellSaveDc && (
                  <Badge variant="info" size="sm">
                    +{item.bonusSpellSaveDc} Spell Save DC
                  </Badge>
                )}
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
                className="text-accent-blue-text-muted hover:bg-surface-hover hover:text-accent-blue-text"
              >
                <Edit2 size={16} />
              </Button>
              <Button
                onClick={() => onDelete(item.id)}
                variant="ghost"
                size="xs"
                title="Delete item"
                className="text-accent-red-text-muted hover:bg-surface-hover hover:text-accent-red-text"
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
                    ? 'bg-linear-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700'
                    : 'hover:border-accent-purple-border hover:bg-surface-hover'
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
        <Dialog
          open={true}
          onOpenChange={open => {
            if (!open) setSelectedCharge(null);
          }}
        >
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>
                {selectedCharge.name || 'Charge Ability'}
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="space-y-4">
                {/* Item name */}
                <div className="text-muted text-sm">
                  From:{' '}
                  <span className="text-body font-medium">{item.name}</span>
                </div>

                {/* Description */}
                {selectedCharge.description ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: selectedCharge.description,
                      }}
                      className="text-body"
                    />
                  </div>
                ) : (
                  <p className="text-muted text-sm italic">
                    No description provided.
                  </p>
                )}

                {/* Charges info */}
                <div className="border-accent-purple-border bg-accent-purple-bg rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-body text-sm font-medium">
                      Charges
                    </span>
                    <div className="text-muted flex items-center gap-1 text-xs">
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
                          className="border-accent-green-border text-accent-green-text-muted hover:bg-accent-green-bg"
                        >
                          Restore
                        </Button>

                        <div className="text-center">
                          <span
                            className={`text-2xl font-bold ${
                              isExhausted
                                ? 'text-accent-red-text-muted'
                                : chargesRemaining <= 1
                                  ? 'text-accent-orange-text-muted'
                                  : 'text-accent-purple-text-muted'
                            }`}
                          >
                            {chargesRemaining}
                          </span>
                          <span className="text-muted text-lg">
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
                          className="border-accent-red-border text-accent-red-text-muted hover:bg-accent-red-bg"
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
                      <div className="bg-surface-hover mt-3 h-2 w-full rounded-full">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            isExhausted
                              ? 'bg-accent-red-bg-strong'
                              : chargesRemaining <= 1
                                ? 'bg-accent-orange-bg-strong'
                                : 'bg-accent-purple-bg-strong'
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
                  <p className="text-muted text-xs">
                    <Info size={12} className="mr-1 inline" />
                    Scales with proficiency bonus (×
                    {selectedCharge.proficiencyMultiplier || 1})
                  </p>
                )}
              </div>
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
