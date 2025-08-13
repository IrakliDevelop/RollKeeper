import React from 'react';
import { useSimpleDiceRoll } from '@/hooks/useSimpleDiceRoll';
import { RollSummary } from '@/types/dice';

export interface DiceButtonProps {
  notation: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onRollComplete?: (summary: RollSummary) => void;
  onError?: (error: string) => void;
  showDiceIcon?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}

const variantStyles = {
  primary: 'bg-blue-500 hover:bg-blue-600 text-white',
  secondary: 'bg-gray-500 hover:bg-gray-600 text-white',
  success: 'bg-green-500 hover:bg-green-600 text-white',
  warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
};

/**
 * A simple button that rolls dice when clicked
 * Perfect for integrating dice rolls into existing UI elements
 */
export function DiceButton({
  notation,
  children,
  className = '',
  disabled = false,
  onRollComplete,
  onError,
  showDiceIcon = true,
  variant = 'primary'
}: DiceButtonProps) {
  
  const { isReady, isRolling, roll } = useSimpleDiceRoll({
    onRollComplete,
    onError
  });

  const handleClick = async () => {
    if (isReady && !isRolling && !disabled) {
      await roll(notation);
    }
  };

  const baseStyles = 'px-3 py-2 rounded transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed';
  const variantStyle = variantStyles[variant];
  const loadingStyle = isRolling ? 'opacity-75 cursor-wait' : '';
  
  return (
    <button
      onClick={handleClick}
      disabled={!isReady || isRolling || disabled}
      className={`${baseStyles} ${variantStyle} ${loadingStyle} ${className}`}
      title={
        !isReady ? 'Dice system initializing...' :
        isRolling ? 'Rolling dice...' :
        `Roll ${notation}`
      }
    >
      {showDiceIcon && (
        <span className="mr-1">
          {isRolling ? '⏳' : '🎲'}
        </span>
      )}
      {children}
    </button>
  );
}