'use client';

import React from 'react';

interface CustomSwitcherProps {
  leftLabel: string;
  rightLabel: string;
  leftValue: boolean | string;
  rightValue: boolean | string;
  currentValue: boolean | string;
  onChange: (value: boolean | string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'purple' | 'green' | 'amber';
}

export const CustomSwitcher: React.FC<CustomSwitcherProps> = ({
  leftLabel,
  rightLabel,
  leftValue,
  rightValue,
  currentValue,
  onChange,
  className = '',
  size = 'md',
  color = 'blue'
}) => {
  const isRightSelected = currentValue === rightValue;

  const sizeClasses = {
    sm: {
      container: 'h-8',
      button: 'px-3 py-1 text-xs',
      slider: 'h-6 w-6'
    },
    md: {
      container: 'h-10',
      button: 'px-4 py-2 text-sm',
      slider: 'h-8 w-8'
    },
    lg: {
      container: 'h-12',
      button: 'px-6 py-3 text-base',
      slider: 'h-10 w-10'
    }
  };

  const colorClasses = {
    blue: {
      bg: 'bg-blue-100',
      slider: 'bg-blue-600',
      activeText: 'text-white',
      inactiveText: 'text-blue-700',
      border: 'border-blue-200'
    },
    purple: {
      bg: 'bg-purple-100',
      slider: 'bg-purple-600',
      activeText: 'text-white',
      inactiveText: 'text-purple-700',
      border: 'border-purple-200'
    },
    green: {
      bg: 'bg-green-100',
      slider: 'bg-green-600',
      activeText: 'text-white',
      inactiveText: 'text-green-700',
      border: 'border-green-200'
    },
    amber: {
      bg: 'bg-amber-100',
      slider: 'bg-amber-600',
      activeText: 'text-white',
      inactiveText: 'text-amber-700',
      border: 'border-amber-200'
    }
  };

  const currentSize = sizeClasses[size];
  const currentColor = colorClasses[color];

  return (
    <div className={`inline-flex items-center ${className}`}>
      <div className={`
        relative inline-flex items-center 
        ${currentColor.bg} ${currentColor.border} 
        border-2 rounded-full p-1 
        ${currentSize.container}
        transition-all duration-300 ease-in-out
        shadow-inner
      `}>
        {/* Sliding background */}
        <div
          className={`
            absolute top-1 bottom-1 
            ${currentColor.slider}
            rounded-full 
            transition-all duration-300 ease-in-out
            shadow-lg
          `}
          style={{
            left: isRightSelected ? '50%' : '4px',
            right: isRightSelected ? '4px' : '50%',
          }}
        />
        
        {/* Left option */}
        <button
          onClick={() => onChange(leftValue)}
          className={`
            relative z-10 flex-1 text-center font-semibold
            ${currentSize.button}
            transition-all duration-300 ease-in-out
            rounded-full
            ${!isRightSelected ? currentColor.activeText : currentColor.inactiveText}
            hover:scale-105 active:scale-95
          `}
        >
          {leftLabel}
        </button>
        
        {/* Right option */}
        <button
          onClick={() => onChange(rightValue)}
          className={`
            relative z-10 flex-1 text-center font-semibold
            ${currentSize.button}
            transition-all duration-300 ease-in-out
            rounded-full
            ${isRightSelected ? currentColor.activeText : currentColor.inactiveText}
            hover:scale-105 active:scale-95
          `}
        >
          {rightLabel}
        </button>
      </div>
    </div>
  );
}; 