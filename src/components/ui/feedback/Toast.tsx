'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Dice6, Shield, Zap, CheckCircle2, XCircle, Info, Moon } from 'lucide-react';

export interface ToastData {
  id: string;
  type: 'attack' | 'save' | 'damage' | 'info' | 'success' | 'error' | 'rest';
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
        return 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white border-slate-600 shadow-slate-900/50';
      case 'save':
        return 'bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white border-blue-500 shadow-blue-900/50';
      case 'damage':
        return 'bg-gradient-to-br from-amber-600 via-orange-600 to-orange-700 text-white border-amber-500 shadow-orange-900/50';
      case 'success':
        return 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white border-emerald-400 shadow-emerald-900/50';
      case 'error':
        return 'bg-gradient-to-br from-red-600 via-red-700 to-red-800 text-white border-red-500 shadow-red-900/50';
      case 'rest':
        return 'bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 text-white border-indigo-500 shadow-purple-900/50';
      default:
        return 'bg-gradient-to-br from-gray-600 via-gray-700 to-gray-800 text-white border-gray-500 shadow-gray-900/50';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'attack':
        return <Dice6 size={22} className="text-white drop-shadow-lg" />;
      case 'save':
        return <Shield size={22} className="text-white drop-shadow-lg" />;
      case 'damage':
        return <Zap size={22} className="text-white drop-shadow-lg" />;
      case 'success':
        return <CheckCircle2 size={22} className="text-white drop-shadow-lg" />;
      case 'error':
        return <XCircle size={22} className="text-white drop-shadow-lg" />;
      case 'rest':
        return <Moon size={22} className="text-white drop-shadow-lg" />;
      case 'info':
        return <Info size={22} className="text-white drop-shadow-lg" />;
      default:
        return <Dice6 size={22} className="text-white drop-shadow-lg" />;
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border-2 shadow-2xl backdrop-blur-sm transition-all duration-300 ease-out ${getToastStyles()} ${isVisible && !isExiting ? 'translate-x-0 transform opacity-100 scale-100' : 'translate-x-full transform opacity-0 scale-95'} ${isExiting ? 'translate-x-full transform opacity-0 scale-95' : ''} max-w-[420px] min-w-[320px]`}
    >
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.3),transparent)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.2),transparent)]"></div>
      </div>

      {/* Shimmer effect */}
      <div className="absolute inset-0 opacity-30">
        <div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          style={{
            animation: 'shimmer 2s ease-in-out infinite',
            transform: 'translateX(-100%)',
          }}
        />
      </div>

      <div className="relative px-5 py-4">
        <div className="flex items-start gap-3">
          {/* Icon with glowing effect */}
          <div className="flex-shrink-0 rounded-lg bg-white/20 p-2 backdrop-blur-sm ring-1 ring-white/30">
            {getIcon()}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h4 className="truncate text-lg font-bold tracking-tight text-white drop-shadow-md">
                {toast.title}
              </h4>
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 rounded-lg p-1.5 text-white/70 ring-1 ring-white/20 transition-all hover:bg-white/20 hover:text-white hover:ring-white/40 active:scale-95"
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>

            <p className="mb-2 text-sm font-medium leading-relaxed text-white/95 drop-shadow-sm">
              {toast.message}
            </p>

            {toast.details && toast.details.length > 0 && (
              <div className="mt-3 space-y-1.5 rounded-lg bg-black/20 px-3 py-2 backdrop-blur-sm">
                {toast.details.map((detail, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-xs font-medium text-white/90"
                  >
                    <span className="mt-0.5 text-white/60">•</span>
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute right-0 bottom-0 left-0 h-1.5 overflow-hidden bg-black/30">
        <div
          className="h-full bg-gradient-to-r from-white/80 via-white/60 to-white/80 shadow-lg transition-all ease-linear"
          style={{
            width: '100%',
            animation: `toast-progress ${toast.duration || 5000}ms linear forwards`,
          }}
        />
      </div>

      <style>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes shimmer {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 space-y-2">
      <div className="pointer-events-auto space-y-2">
        {toasts.map(toast => (
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

  const showAttackRoll = useCallback(
    (
      weaponName: string,
      roll: number,
      bonus: number,
      isCrit: boolean,
      damage?: string,
      damageType?: string
    ) => {
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
        details.push(
          `💥 Damage: ${damage}${damageType ? ` (${damageType})` : ''}`
        );
        if (isCrit) {
          details.push("🔥 Don't forget to double the damage dice!");
        }
      }

      addToast({
        type: 'attack',
        title,
        message,
        details,
        duration: isCrit ? 7000 : 5000,
      });
    },
    [addToast]
  );

  const showSavingThrow = useCallback(
    (
      spellName: string,
      saveDC: number,
      saveType?: string,
      damage?: string,
      damageType?: string
    ) => {
      const details: string[] = [];

      if (damage) {
        details.push(
          `💥 Damage: ${damage}${damageType ? ` (${damageType})` : ''}`
        );
        details.push('✅ Success: Half damage');
        details.push('❌ Failure: Full damage');
      }

      addToast({
        type: 'save',
        title: `🛡️ ${spellName}`,
        message: `DC ${saveDC}${saveType ? ` ${saveType} Save` : ' Save'}`,
        details,
        duration: 6000,
      });
    },
    [addToast]
  );

  const showDamageRoll = useCallback(
    (
      weaponName: string,
      damageRoll: string,
      damageType?: string,
      versatile = false
    ) => {
      addToast({
        type: 'damage',
        title: `💥 ${weaponName}${versatile ? ' (Versatile)' : ''}`,
        message: `Damage: ${damageRoll}`,
        details: damageType
          ? [
              `🗡️ ${damageType.charAt(0).toUpperCase() + damageType.slice(1)} damage`,
            ]
          : [],
        duration: 4000,
      });
    },
    [addToast]
  );

  const showShortRest = useCallback(() => {
    addToast({
      type: 'rest',
      title: '☀️ Short Rest Complete',
      message: 'Your character has taken a short rest',
      details: [
        'Short rest abilities restored',
        'Pact Magic slots restored',
        'Reaction reset',
        'Ready to continue your adventure!'
      ],
      duration: 5000,
    });
  }, [addToast]);

  const showLongRest = useCallback(() => {
    addToast({
      type: 'rest',
      title: '🌙 Long Rest Complete',
      message: 'Your character has taken a long rest',
      details: [
        'All abilities restored',
        'All spell slots restored',
        'Hit points fully restored',
        'Hit dice partially restored',
        'Ready for new challenges!'
      ],
      duration: 6000,
    });
  }, [addToast]);

  return {
    toasts,
    addToast,
    dismissToast,
    showAttackRoll,
    showSavingThrow,
    showDamageRoll,
    showShortRest,
    showLongRest,
  };
};
