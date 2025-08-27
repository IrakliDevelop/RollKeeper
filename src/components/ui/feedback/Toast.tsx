'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Dice6, Shield, Zap } from 'lucide-react';

export interface ToastData {
  id: string;
  type: 'attack' | 'save' | 'damage' | 'info' | 'success' | 'error';
  title: string;
  message: string;
  duration?: number;
  details?: string[];
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 300);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 50);

    // Auto dismiss
    const timer = setTimeout(() => {
      handleDismiss();
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.duration, handleDismiss]);

  const getToastStyles = () => {
    switch (toast.type) {
      case 'attack':
        return 'bg-gradient-to-r from-slate-700 to-slate-800 text-white border-slate-600';
      case 'save':
        return 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-500';
      case 'damage':
        return 'bg-gradient-to-r from-amber-600 to-orange-600 text-white border-amber-500';
      case 'success':
        return 'bg-gradient-to-r from-emerald-600 to-green-600 text-white border-emerald-500';
      case 'error':
        return 'bg-gradient-to-r from-red-600 to-red-700 text-white border-red-500';
      default:
        return 'bg-gradient-to-r from-gray-600 to-gray-700 text-white border-gray-500';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'attack':
        return <Dice6 size={20} className="text-white" />;
      case 'save':
        return <Shield size={20} className="text-white" />;
      case 'damage':
        return <Zap size={20} className="text-white" />;
      default:
        return <Dice6 size={20} className="text-white" />;
    }
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg shadow-2xl border-2 backdrop-blur-sm
        transition-all duration-300 ease-out
        ${getToastStyles()}
        ${isVisible && !isExiting ? 'transform translate-x-0 opacity-100' : 'transform translate-x-full opacity-0'}
        ${isExiting ? 'transform translate-x-full opacity-0' : ''}
        min-w-[300px] max-w-[400px]
      `}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
      </div>
      
      <div className="relative p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-1">
            {getIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-lg font-bold text-white truncate">
                {toast.title}
              </h4>
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 text-white/80 hover:text-white transition-colors p-1 rounded hover:bg-white/20"
              >
                <X size={16} />
              </button>
            </div>
            
            <p className="text-white/90 font-medium text-base mb-2">
              {toast.message}
            </p>
            
            {toast.details && toast.details.length > 0 && (
              <div className="space-y-1">
                {toast.details.map((detail, index) => (
                  <div key={index} className="text-white/80 text-sm font-medium">
                    {detail}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
        <div 
          className="h-full bg-white/60 transition-all ease-linear"
          style={{
            width: '100%',
            animation: `toast-progress ${toast.duration || 5000}ms linear forwards`
          }}
        />
      </div>
      
      <style>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
      <div className="space-y-2 pointer-events-auto">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
};

// Hook for managing toasts
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setToasts(prev => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showAttackRoll = useCallback((weaponName: string, roll: number, bonus: number, isCrit: boolean, damage?: string, damageType?: string) => {
    const total = roll + bonus;
    let title = `🎲 ${weaponName}`;
    let message = `${roll} + ${bonus} = ${total}`;
    const details: string[] = [];
    
    if (isCrit) {
      title += ' ✨ CRITICAL!';
      message = `${roll} (CRIT!) + ${bonus} = ${total}`;
    } else if (roll === 1) {
      title += ' 💥 FUMBLE!';
      message = `${roll} (FUMBLE!) + ${bonus} = ${total}`;
    }
    
    if (damage) {
      details.push(`💥 Damage: ${damage}${damageType ? ` (${damageType})` : ''}`);
      if (isCrit) {
        details.push('🔥 Don\'t forget to double the damage dice!');
      }
    }

    addToast({
      type: 'attack',
      title,
      message,
      details,
      duration: isCrit ? 7000 : 5000
    });
  }, [addToast]);

  const showSavingThrow = useCallback((spellName: string, saveDC: number, saveType?: string, damage?: string, damageType?: string) => {
    const details: string[] = [];
    
    if (damage) {
      details.push(`💥 Damage: ${damage}${damageType ? ` (${damageType})` : ''}`);
      details.push('✅ Success: Half damage');
      details.push('❌ Failure: Full damage');
    }

    addToast({
      type: 'save',
      title: `🛡️ ${spellName}`,
      message: `DC ${saveDC}${saveType ? ` ${saveType} Save` : ' Save'}`,
      details,
      duration: 6000
    });
  }, [addToast]);

  const showDamageRoll = useCallback((weaponName: string, damageRoll: string, damageType?: string, versatile = false) => {
    addToast({
      type: 'damage',
      title: `💥 ${weaponName}${versatile ? ' (Versatile)' : ''}`,
      message: `Damage: ${damageRoll}`,
      details: damageType ? [`🗡️ ${damageType.charAt(0).toUpperCase() + damageType.slice(1)} damage`] : [],
      duration: 4000
    });
  }, [addToast]);

  return {
    toasts,
    addToast,
    dismissToast,
    showAttackRoll,
    showSavingThrow,
    showDamageRoll
  };
}; 