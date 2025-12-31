'use client';

import React from 'react';
import { Check, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CustomCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  indeterminate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'emerald' | 'amber' | 'blue' | 'purple' | 'red';
  className?: string;
}

const sizeClasses = {
  sm: {
    checkbox: 'h-4 w-4',
    icon: 'h-3 w-3',
    text: 'text-sm',
    gap: 'gap-2',
  },
  md: {
    checkbox: 'h-5 w-5',
    icon: 'h-3.5 w-3.5',
    text: 'text-sm',
    gap: 'gap-3',
  },
  lg: {
    checkbox: 'h-6 w-6',
    icon: 'h-4 w-4',
    text: 'text-base',
    gap: 'gap-3',
  },
};

const variantClasses = {
  default: {
    unchecked: 'border-slate-600 bg-slate-700/50',
    checked: 'border-slate-400 bg-slate-600',
    hover: 'hover:border-slate-500',
    checkIcon: 'text-white',
  },
  emerald: {
    unchecked: 'border-slate-600 bg-slate-700/50',
    checked: 'border-emerald-500 bg-emerald-600',
    hover: 'hover:border-emerald-500/50',
    checkIcon: 'text-white',
  },
  amber: {
    unchecked: 'border-slate-600 bg-slate-700/50',
    checked: 'border-amber-500 bg-amber-600',
    hover: 'hover:border-amber-500/50',
    checkIcon: 'text-white',
  },
  blue: {
    unchecked: 'border-slate-600 bg-slate-700/50',
    checked: 'border-blue-500 bg-blue-600',
    hover: 'hover:border-blue-500/50',
    checkIcon: 'text-white',
  },
  purple: {
    unchecked: 'border-slate-600 bg-slate-700/50',
    checked: 'border-purple-500 bg-purple-600',
    hover: 'hover:border-purple-500/50',
    checkIcon: 'text-white',
  },
  red: {
    unchecked: 'border-slate-600 bg-slate-700/50',
    checked: 'border-red-500 bg-red-600',
    hover: 'hover:border-red-500/50',
    checkIcon: 'text-white',
  },
};

export default function CustomCheckbox({
  checked,
  onChange,
  label,
  description,
  icon,
  disabled = false,
  indeterminate = false,
  size = 'md',
  variant = 'emerald',
  className = '',
}: CustomCheckboxProps) {
  const sizeStyle = sizeClasses[size];
  const variantStyle = variantClasses[variant];

  const handleChange = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const isCheckedOrIndeterminate = checked || indeterminate;

  return (
    <label
      className={`flex items-start ${sizeStyle.gap} group cursor-pointer ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className} `}
    >
      {/* Custom Checkbox */}
      <div className="relative flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className="sr-only"
        />

        <motion.div
          whileTap={disabled ? {} : { scale: 0.95 }}
          className={` ${sizeStyle.checkbox} relative flex items-center justify-center overflow-hidden rounded border-2 transition-all duration-200 ${isCheckedOrIndeterminate ? variantStyle.checked : variantStyle.unchecked} ${!disabled ? variantStyle.hover : ''} ${!disabled ? 'group-hover:shadow-lg' : ''} `}
        >
          {/* Background glow effect */}
          {isCheckedOrIndeterminate && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.3 }}
              className="absolute inset-0 rounded bg-white"
            />
          )}

          {/* Check/Indeterminate Icon */}
          <AnimatePresence mode="wait">
            {isCheckedOrIndeterminate && (
              <motion.div
                key={indeterminate ? 'minus' : 'check'}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className={`${sizeStyle.icon} ${variantStyle.checkIcon} relative z-10`}
              >
                {indeterminate ? (
                  <Minus className={sizeStyle.icon} strokeWidth={3} />
                ) : (
                  <Check className={sizeStyle.icon} strokeWidth={3} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Label and Description */}
      {(label || description || icon) && (
        <div className="min-w-0 flex-1">
          {(label || icon) && (
            <div className="flex items-center gap-2">
              {icon && (
                <span
                  className={`flex-shrink-0 text-slate-400 transition-colors ${!disabled && checked ? 'text-emerald-400' : ''} `}
                >
                  {icon}
                </span>
              )}
              {label && (
                <span
                  className={` ${sizeStyle.text} font-medium text-slate-300 transition-colors ${!disabled ? 'group-hover:text-slate-200' : ''} ${!disabled && checked ? 'text-slate-200' : ''} `}
                >
                  {label}
                </span>
              )}
            </div>
          )}
          {description && (
            <p
              className={`mt-1 text-xs text-slate-400 transition-colors ${!disabled ? 'group-hover:text-slate-300' : ''} `}
            >
              {description}
            </p>
          )}
        </div>
      )}
    </label>
  );
}
