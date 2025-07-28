'use client';

import React, { useState } from 'react';
import { 
  Heart, 
  Plus, 
  Minus, 
  RotateCcw, 
  Calculator, 
  Edit3, 
  Zap,
  Skull,
  Shield,
  HelpCircle
} from 'lucide-react';
import { HitPoints, ClassInfo } from '@/types/character';
import { isDying, isDead, isStabilized } from '@/utils/hpCalculations';

interface HitPointManagerProps {
  hitPoints: HitPoints;
  classInfo: ClassInfo;
  level: number;
  constitutionScore: number;
  onApplyDamage: (damage: number) => void;
  onApplyHealing: (healing: number) => void;
  onAddTemporaryHP: (tempHP: number) => void;
  onMakeDeathSave: (isSuccess: boolean, isCritical?: boolean) => void;
  onResetDeathSaves: () => void;
  onToggleCalculationMode: () => void;
  onRecalculateMaxHP: () => void;
  onUpdateHitPoints: (updates: Partial<HitPoints>) => void;
  className?: string;
}

export default function HitPointManager({
  hitPoints,
  classInfo,
  level,
  onApplyDamage,
  onApplyHealing,
  onAddTemporaryHP,
  onMakeDeathSave,
  onResetDeathSaves,
  onToggleCalculationMode,
  onUpdateHitPoints,
  className = ''
}: HitPointManagerProps) {
  const [damageAmount, setDamageAmount] = useState('');
  const [healingAmount, setHealingAmount] = useState('');
  const [tempHPAmount, setTempHPAmount] = useState('');
  const [deathSaveResult, setDeathSaveResult] = useState<number | null>(null);

  const isCharacterDying = isDying(hitPoints);
  const isCharacterDead = isDead(hitPoints);
  const isCharacterStabilized = isStabilized(hitPoints);
  const isUnconscious = hitPoints.current === 0;

  const handleDamage = () => {
    const damage = parseInt(damageAmount);
    if (!isNaN(damage) && damage > 0) {
      onApplyDamage(damage);
      setDamageAmount('');
    }
  };

  const handleHealing = () => {
    const healing = parseInt(healingAmount);
    if (!isNaN(healing) && healing > 0) {
      onApplyHealing(healing);
      setHealingAmount('');
    }
  };

  const handleTempHP = () => {
    const tempHP = parseInt(tempHPAmount);
    if (!isNaN(tempHP) && tempHP > 0) {
      onAddTemporaryHP(tempHP);
      setTempHPAmount('');
    }
  };

  const handleDeathSave = () => {
    if (deathSaveResult === null) return;
    
    const isSuccess = deathSaveResult >= 10;
    const isCritical = deathSaveResult === 20;
    
    onMakeDeathSave(isSuccess, isCritical);
    setDeathSaveResult(null);
  };

  const getStatusColor = () => {
    if (isCharacterDead) return 'text-black bg-gray-800';
    if (isCharacterDying) return 'text-red-800 bg-red-100';
    if (isCharacterStabilized) return 'text-yellow-800 bg-yellow-100';
    if (isUnconscious) return 'text-orange-800 bg-orange-100';
    if (hitPoints.current <= hitPoints.max * 0.25) return 'text-red-700 bg-red-50';
    if (hitPoints.current <= hitPoints.max * 0.5) return 'text-yellow-700 bg-yellow-50';
    return 'text-green-700 bg-green-50';
  };

  const getCurrentHPBoxColor = () => {
    if (isCharacterDead) return 'bg-gray-800 border-gray-900';
    if (isCharacterDying) return 'bg-red-100 border-red-300';
    if (isCharacterStabilized) return 'bg-yellow-50 border-yellow-300';
    if (isUnconscious) return 'bg-orange-50 border-orange-300';
    if (hitPoints.current <= hitPoints.max * 0.25) return 'bg-red-50 border-red-200';
    if (hitPoints.current <= hitPoints.max * 0.5) return 'bg-yellow-50 border-yellow-200';
    return 'bg-green-50 border-green-200';
  };

  const getCurrentHPTextColor = () => {
    if (isCharacterDead) return 'text-white';
    if (isCharacterDying) return 'text-red-800';
    if (isCharacterStabilized) return 'text-yellow-800';
    if (isUnconscious) return 'text-orange-800';
    if (hitPoints.current <= hitPoints.max * 0.25) return 'text-red-800';
    if (hitPoints.current <= hitPoints.max * 0.5) return 'text-yellow-800';
    return 'text-green-800';
  };

  const getStatusText = () => {
    if (isCharacterDead) return '💀 Dead';
    if (isCharacterDying) return '💔 Dying';
    if (isCharacterStabilized) return '😵 Stabilized';
    if (isUnconscious) return '😵 Unconscious';
    return '❤️ Alive';
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg border border-red-200 p-6 space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-red-800 flex items-center gap-2">
          <Heart size={20} />
          Hit Points
        </h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      </div>

             {/* HP Display */}
       <div className="grid grid-cols-3 gap-2 sm:gap-4">
         <div className="text-center">
           <div className={`border-2 rounded-lg p-2 sm:p-3 transition-colors ${getCurrentHPBoxColor()} min-h-[80px] sm:min-h-[90px] flex flex-col justify-center`}>
             <div className={`text-xs font-medium mb-1 ${getCurrentHPTextColor()}`}>CURRENT</div>
             <input
               type="number"
               value={hitPoints.current}
               onChange={(e) => onUpdateHitPoints({ current: parseInt(e.target.value) || 0 })}
               className={`text-lg sm:text-xl font-bold bg-transparent border-none outline-none text-center w-full ${getCurrentHPTextColor()} leading-tight`}
               min="0"
               max={hitPoints.max}
               style={{ maxWidth: '100%' }}
             />
           </div>
         </div>
         
         <div className="text-center">
           <div className="bg-red-100 border-2 border-red-300 rounded-lg p-2 sm:p-3 relative min-h-[80px] sm:min-h-[90px] flex flex-col justify-center">
             <div className="text-xs font-medium text-red-800 mb-1 flex items-center justify-center gap-1">
               <span className="hidden sm:inline">MAXIMUM</span>
               <span className="sm:hidden">MAX</span>
               <button
                 onClick={onToggleCalculationMode}
                 className="text-red-600 hover:text-red-800 transition-colors"
                 title={`Switch to ${hitPoints.calculationMode === 'auto' ? 'manual' : 'auto'} calculation`}
               >
                 {hitPoints.calculationMode === 'auto' ? <Calculator size={12} /> : <Edit3 size={12} />}
               </button>
             </div>
             <input
               type="number"
               value={hitPoints.max}
               onChange={(e) => onUpdateHitPoints({ max: parseInt(e.target.value) || 0 })}
               className="text-lg sm:text-xl font-bold text-red-900 bg-transparent border-none outline-none text-center w-full leading-tight"
               disabled={hitPoints.calculationMode === 'auto'}
               min="1"
               style={{ maxWidth: '100%' }}
             />
             {hitPoints.calculationMode === 'auto' && (
               <div className="absolute -top-1 -right-1">
                 <div className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                   AUTO
                 </div>
               </div>
             )}
           </div>
         </div>
         
         <div className="text-center">
           <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-2 sm:p-3 min-h-[80px] sm:min-h-[90px] flex flex-col justify-center">
             <div className="text-xs font-medium text-blue-700 mb-1">
               <span>TEMP</span>
             </div>
             <input
               type="number"
               value={hitPoints.temporary}
               onChange={(e) => onUpdateHitPoints({ temporary: parseInt(e.target.value) || 0 })}
               className="text-lg sm:text-xl font-bold text-blue-800 bg-transparent border-none outline-none text-center w-full leading-tight"
               min="0"
               style={{ maxWidth: '100%' }}
             />
           </div>
         </div>
       </div>

             {/* HP Management Actions */}
       <div className="space-y-3">
         {/* Damage */}
         <div className="space-y-2">
           <label className="block text-sm font-medium text-red-700">Apply Damage</label>
           <div className="flex gap-2">
             <input
               type="number"
               value={damageAmount}
               onChange={(e) => setDamageAmount(e.target.value)}
               placeholder="Amount"
               className="w-24 px-3 py-2 border border-red-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-800 text-center"
               min="1"
             />
             <button
               onClick={handleDamage}
               disabled={!damageAmount || parseInt(damageAmount) <= 0}
               className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
             >
               <Minus size={16} />
               Apply Damage
             </button>
           </div>
         </div>

         {/* Healing */}
         <div className="space-y-2">
           <label className="block text-sm font-medium text-green-700">Apply Healing</label>
           <div className="flex gap-2">
             <input
               type="number"
               value={healingAmount}
               onChange={(e) => setHealingAmount(e.target.value)}
               placeholder="Amount"
               className="w-24 px-3 py-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800 text-center"
               min="1"
             />
             <button
               onClick={handleHealing}
               disabled={!healingAmount || parseInt(healingAmount) <= 0}
               className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
             >
               <Plus size={16} />
               Apply Healing
             </button>
           </div>
         </div>

         {/* Temporary HP */}
         <div className="space-y-2">
           <label className="block text-sm font-medium text-blue-700">Add Temporary HP</label>
           <div className="flex gap-2">
             <input
               type="number"
               value={tempHPAmount}
               onChange={(e) => setTempHPAmount(e.target.value)}
               placeholder="Amount"
               className="w-24 px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 text-center"
               min="1"
             />
             <button
               onClick={handleTempHP}
               disabled={!tempHPAmount || parseInt(tempHPAmount) <= 0}
               className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
             >
               <Shield size={16} />
               Add Temp HP
             </button>
           </div>
         </div>
       </div>

      {/* Death Saving Throws */}
      {(isCharacterDying || isCharacterStabilized || hitPoints.deathSaves) && (
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-semibold text-gray-800 flex items-center gap-2">
              <Skull size={18} />
              Death Saving Throws
            </h4>
            <button
              onClick={onResetDeathSaves}
              className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
              title="Reset death saves"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>

          {hitPoints.deathSaves && (
            <div className="space-y-4">
              {/* Success/Failure Display */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-green-700 mb-2">Successes</div>
                  <div className="flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-6 h-6 border-2 rounded-full ${
                          i <= hitPoints.deathSaves!.successes
                            ? 'bg-green-500 border-green-500'
                            : 'bg-white border-gray-400'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-red-700 mb-2">Failures</div>
                  <div className="flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-6 h-6 border-2 rounded-full ${
                          i <= hitPoints.deathSaves!.failures
                            ? 'bg-red-500 border-red-500'
                            : 'bg-white border-gray-400'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Death Save Roll */}
              {isCharacterDying && (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-700">Make Death Saving Throw</div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={deathSaveResult || ''}
                      onChange={(e) => setDeathSaveResult(parseInt(e.target.value) || null)}
                      placeholder="d20 result"
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                      min="1"
                      max="20"
                    />
                    <button
                      onClick={handleDeathSave}
                      disabled={deathSaveResult === null || deathSaveResult < 1 || deathSaveResult > 20}
                      className="flex items-center gap-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      <Zap size={16} />
                      Roll Save
                    </button>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>• Roll 10 or higher to succeed</p>
                    <p>• Natural 20: Regain 1 HP and become conscious</p>
                    <p>• 3 successes: Stabilized but unconscious</p>
                    <p>• 3 failures: Dead</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* HP Calculation Mode Info */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-start gap-3">
          <HelpCircle size={16} className="text-gray-500 mt-0.5" />
          <div className="text-xs text-gray-600 space-y-1">
            <p><strong>Auto Mode:</strong> Max HP calculated using D&D 5e rules (Level 1: full hit die + CON, subsequent levels: average hit die + CON)</p>
            <p><strong>Manual Mode:</strong> Set your own maximum HP value</p>
            {hitPoints.calculationMode === 'auto' && (
              <p className="text-blue-600">
                Current calculation: Level {level} {classInfo.name} = {hitPoints.max} HP
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 