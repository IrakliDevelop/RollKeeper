'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { AppIcon, type IconName } from '@/components/ui/icons';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import type { RestSlots } from '@/utils/calculations';
import { cn } from '@/utils/cn';

export interface ToastDetail {
  text: string;
  icon?: IconName;
}

export interface ToastData {
  id: string;
  type: 'attack' | 'save' | 'damage' | 'info' | 'success' | 'error' | 'rest';
  title: string;
  message: string;
  icon?: IconName;
  duration?: number;
  details?: Array<string | ToastDetail>;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

/** Enter and exit time; matches duration-180 on the toast. */
const TOAST_MOTION_MS = 180;

/**
 * How long a toast's text stays in the live region: long enough for a screen
 * reader to queue it, short enough that reading the page doesn't meet it
 * twice.
 */
const ANNOUNCE_MS = 1000;

interface ToastRole {
  /** The 3px left rule. */
  rule: string;
  icon: string;
  /** The countdown bar. */
  bar: string;
}

const VERDIGRIS: ToastRole = {
  rule: 'border-l-verdigris-border',
  icon: 'text-verdigris-text',
  bar: 'bg-verdigris-fill',
};
const BLOOD: ToastRole = {
  rule: 'border-l-blood-border',
  icon: 'text-blood-text',
  bar: 'bg-blood-fill',
};
const NEUTRAL: ToastRole = {
  rule: 'border-l-input-border',
  icon: 'text-muted',
  bar: 'bg-input-border',
};

/**
 * Colour carries meaning: healing and success are verdigris, harm and
 * errors are blood, and rolls and information stay neutral.
 */
const TOAST_ROLES: Record<ToastData['type'], ToastRole> = {
  success: VERDIGRIS,
  rest: VERDIGRIS,
  error: BLOOD,
  damage: BLOOD,
  attack: NEUTRAL,
  save: NEUTRAL,
  info: NEUTRAL,
};

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const duration = toast.duration || 5000;
  const role = TOAST_ROLES[toast.type] ?? NEUTRAL;

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, TOAST_MOTION_MS);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    // Animate in
    const visibilityTimer = setTimeout(() => setIsVisible(true), 50);

    // Auto dismiss
    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => {
      clearTimeout(visibilityTimer);
      clearTimeout(timer);
    };
  }, [duration, handleDismiss]);

  const getIconName = (): IconName => {
    if (toast.icon) return toast.icon;
    switch (toast.type) {
      case 'attack':
        return 'attack';
      case 'save':
        return 'save';
      case 'damage':
        return 'damage';
      case 'success':
        return 'confirm';
      case 'error':
        return 'error';
      case 'rest':
        return 'restLong';
      case 'info':
        return 'unknown';
      default:
        return 'dice';
    }
  };

  const shown = isVisible && !isExiting;

  return (
    <div
      data-toast-type={toast.type}
      className={cn(
        OVERLAY_SURFACE,
        'relative max-w-[420px] min-w-[320px] overflow-hidden border-l-[3px] transition-[opacity,translate] duration-180 ease-out',
        role.rule,
        shown ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      )}
    >
      <div className="flex items-start gap-3 py-3 pr-2 pl-4">
        <AppIcon
          name={getIconName()}
          className={cn('mt-1 h-5 w-5 shrink-0', role.icon)}
        />

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-heading truncate text-lg font-bold tracking-tight">
              {toast.title}
            </h4>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleDismiss}
              aria-label="Dismiss notification"
              className="text-muted hover:text-heading -mt-0.5 size-8 shrink-0 p-0"
            >
              <X size={16} aria-hidden />
            </Button>
          </div>

          <p className="text-body mt-0.5 text-sm leading-relaxed">
            {toast.message}
          </p>

          {toast.details && toast.details.length > 0 && (
            <ul className="mt-2 space-y-1">
              {toast.details.map((detail, index) => {
                const item =
                  typeof detail === 'string' ? { text: detail } : detail;
                return (
                  <li
                    key={index}
                    className="text-muted flex items-start gap-2 text-xs"
                  >
                    {item.icon ? (
                      <AppIcon
                        name={item.icon}
                        className="mt-0.5 h-3 w-3 shrink-0"
                      />
                    ) : (
                      <span className="text-faint mt-0.5" aria-hidden>
                        •
                      </span>
                    )}
                    <span>{item.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Countdown: a thin role bar, hidden when motion is reduced. */}
      <div
        aria-hidden
        data-toast-countdown
        className="absolute right-0 bottom-0 left-0 h-0.5 motion-reduce:hidden"
      >
        <div
          className={cn('h-full origin-left', role.bar)}
          style={{ animation: `toast-countdown ${duration}ms linear forwards` }}
        />
      </div>
    </div>
  );
};

/** A text-only copy of a toast for the live region; removes itself. */
const ToastAnnouncement: React.FC<{ toast: ToastData }> = ({ toast }) => {
  const [announced, setAnnounced] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnnounced(true), ANNOUNCE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (announced) return null;
  return (
    <div>
      <p>{toast.title}</p>
      <p>{toast.message}</p>
      {toast.details?.map((detail, index) => (
        <p key={index}>{typeof detail === 'string' ? detail : detail.text}</p>
      ))}
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
  // The status region stays mounted, so screen readers announce each toast
  // as it is added (politely, and only the new one). It holds a text-only
  // copy, so they hear the title, message and details without the dismiss
  // button, which stays in the visible toast.
  const content = (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[100]">
      <div className="pointer-events-auto space-y-2">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="sr-only"
      >
        {toasts.map(toast => (
          <ToastAnnouncement key={toast.id} toast={toast} />
        ))}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return content;
  return createPortal(content, document.body);
};

/**
 * The long-rest toast, shared by the rest dialog and the calendar (which
 * adds a line when it advances the day). Slot lines only appear for
 * characters who have those slots.
 */
export function longRestToast(
  slots: RestSlots,
  extraDetails: string[] = []
): Omit<ToastData, 'id'> {
  return {
    type: 'rest',
    title: 'Long rest taken',
    icon: 'restLong',
    message: 'Hit points are full and abilities are back',
    details: [
      ...(slots.spellSlots ? ['All spell slots restored'] : []),
      'Hit dice partially restored',
      ...extraDetails,
    ],
    duration: 6000,
  };
}

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
      let title = weaponName;
      let icon: IconName = 'attack';
      let message = `${roll} + ${bonus} = ${total}`;
      const details: ToastDetail[] = [];

      if (isCrit) {
        title += ' — CRITICAL!';
        icon = 'criticalSuccess';
        message = `${roll} (CRIT!) + ${bonus} = ${total}`;
      } else if (roll === 1) {
        title += ' — FUMBLE!';
        icon = 'criticalFailure';
        message = `${roll} (FUMBLE!) + ${bonus} = ${total}`;
      }

      if (damage) {
        details.push({
          icon: 'damage',
          text: `Damage: ${damage}${damageType ? ` (${damageType})` : ''}`,
        });
        if (isCrit) {
          details.push({
            icon: 'criticalSuccess',
            text: "Don't forget to double the damage dice!",
          });
        }
      }

      addToast({
        type: 'attack',
        title,
        icon,
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
      const details: ToastDetail[] = [];

      if (damage) {
        details.push({
          icon: 'damage',
          text: `Damage: ${damage}${damageType ? ` (${damageType})` : ''}`,
        });
        details.push({ icon: 'confirm', text: 'Success: Half damage' });
        details.push({ icon: 'remove', text: 'Failure: Full damage' });
      }

      addToast({
        type: 'save',
        title: spellName,
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
        title: `${weaponName}${versatile ? ' (Versatile)' : ''}`,
        message: `Damage: ${damageRoll}`,
        details: damageType
          ? [
              {
                icon: 'weapon',
                text: `${damageType.charAt(0).toUpperCase() + damageType.slice(1)} damage`,
              },
            ]
          : [],
        duration: 4000,
      });
    },
    [addToast]
  );

  // Slot lines only appear for characters who have those slots.
  const showShortRest = useCallback(
    (slots: RestSlots) => {
      addToast({
        type: 'rest',
        title: 'Short rest taken',
        icon: 'restShort',
        message: 'Abilities that recharge on a short rest are back',
        details: [
          ...(slots.pactMagic ? ['Pact Magic slots restored'] : []),
          'Reaction reset',
        ],
        duration: 5000,
      });
    },
    [addToast]
  );

  const showLongRest = useCallback(
    (slots: RestSlots) => {
      addToast(longRestToast(slots));
    },
    [addToast]
  );

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
