'use client';

import { useState, useEffect } from 'react';
import { formatModifier } from '@/utils/calculations';
import { Eye, Search, Weight, Sparkles, Shield } from 'lucide-react';

const WEIGHT_NUDGES = [
  'Your items are apparently weightless. Bag of Holding?',
  'Zero weight? Are your items made of dreams?',
  'Carrying items but no weight... suspicious.',
  'Physics called, it wants its gravity back.',
  'Feather Fall on your whole inventory, huh?',
  'Your backpack defies the laws of nature.',
  'Weightless gear? Even a Wizard would be impressed.',
  "Tenser's Floating Inventory? That's a new one.",
  'Items detected, weight not found. Classic adventurer move.',
  '0 lbs for all that? Your DM might disagree.',
  'Your items are floating without a care.',
];

interface QuickStatsProps {
  passivePerception: number;
  passiveInsight: number;
  passiveInvestigation: number;
  proficiencyBonus: number;
  carryingCapacity: number;
  currentWeight: number;
  itemCount: number;
  spellAttackBonus?: number | null;
  spellSaveDC?: number | null;
}

export default function QuickStats({
  passivePerception,
  passiveInsight,
  passiveInvestigation,
  proficiencyBonus,
  carryingCapacity,
  currentWeight,
  itemCount,
  spellAttackBonus,
  spellSaveDC,
}: QuickStatsProps) {
  const [nudgeIndex, setNudgeIndex] = useState(0);

  useEffect(() => {
    setNudgeIndex(Math.floor(Math.random() * WEIGHT_NUDGES.length));
  }, []);

  const weightPercent =
    carryingCapacity > 0
      ? Math.round((currentWeight / carryingCapacity) * 100)
      : 0;
  const weightBarPercent = Math.min(100, weightPercent);

  const showWeightNudge = itemCount > 0 && currentWeight === 0;

  const getWeightColor = () => {
    if (weightPercent > 90) return 'bg-red-500';
    if (weightPercent > 66) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getWeightLabel = () => {
    if (weightPercent > 90) return 'text-red-600 dark:text-red-400';
    if (weightPercent > 66) return 'text-amber-600 dark:text-amber-400';
    return 'text-heading';
  };

  return (
    <div className="border-accent-amber-border bg-surface-raised rounded-lg border p-6 shadow-lg">
      <h2 className="border-divider text-heading mb-4 border-b pb-2 text-lg font-bold">
        Quick Stats
      </h2>

      <div className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-body flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-amber-500" />
            Passive Perception
          </span>
          <span className="text-heading font-semibold">
            {passivePerception}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-body flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 text-blue-500" />
            Passive Investigation
          </span>
          <span className="text-heading font-semibold">
            {passiveInvestigation}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-body flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-purple-500" />
            Passive Insight
          </span>
          <span className="text-heading font-semibold">{passiveInsight}</span>
        </div>

        <div className="border-divider my-1 border-t" />

        <div className="flex items-center justify-between">
          <span className="text-body">Proficiency Bonus</span>
          <span className="text-heading font-semibold">
            {formatModifier(proficiencyBonus)}
          </span>
        </div>

        {spellAttackBonus != null && (
          <div className="flex items-center justify-between">
            <span className="text-body flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              Spell Attack
            </span>
            <span className="text-heading font-semibold">
              {formatModifier(spellAttackBonus)}
            </span>
          </div>
        )}
        {spellSaveDC != null && (
          <div className="flex items-center justify-between">
            <span className="text-body flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-indigo-500" />
              Spell Save DC
            </span>
            <span className="text-heading font-semibold">{spellSaveDC}</span>
          </div>
        )}

        <div className="border-divider my-1 border-t" />

        {/* Carrying Capacity */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-body flex items-center gap-1.5">
              <Weight className="h-3.5 w-3.5 text-emerald-500" />
              Carrying Capacity
            </span>
            <span className={`font-semibold ${getWeightLabel()}`}>
              {currentWeight.toFixed(1)} / {carryingCapacity} lbs
            </span>
          </div>
          <div className="bg-divider dark:bg-divider h-2 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full transition-all duration-300 ${getWeightColor()}`}
              style={{ width: `${weightBarPercent}%` }}
            />
          </div>
          {weightPercent > 100 && (
            <p className="mt-1 text-xs font-medium text-red-500">Encumbered!</p>
          )}
          {showWeightNudge && (
            <p className="text-muted mt-1.5 text-[11px] leading-tight italic opacity-70">
              {WEIGHT_NUDGES[nudgeIndex]}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
