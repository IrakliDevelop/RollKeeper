'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  width?: 'auto' | 'full' | string;
}

export default function CustomDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  className = '',
  disabled = false,
  width = 'auto',
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(option => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const widthClass =
    width === 'full' ? 'w-full' : width === 'auto' ? 'w-auto' : width;

  return (
    <div className={`relative ${widthClass} ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`flex w-full items-center justify-between rounded-lg border border-slate-600/50 bg-slate-800/50 px-4 py-3 text-left text-sm font-medium text-white transition-all duration-200 hover:border-slate-500/50 hover:bg-slate-700/50 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/50 focus:outline-none ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${isOpen ? 'border-emerald-500/50 ring-2 ring-emerald-500/50' : ''} `}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {selectedOption?.icon && (
            <span className="flex-shrink-0 text-slate-400">
              {selectedOption.icon}
            </span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full right-0 left-0 z-50 mt-2"
          >
            <div className="overflow-hidden rounded-lg border border-slate-600/50 bg-slate-800/95 shadow-xl shadow-black/30 backdrop-blur-sm">
              <div className="scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800 max-h-64 overflow-y-auto py-2">
                {options.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-slate-700/50 ${value === option.value ? 'bg-emerald-600/20 text-emerald-300' : 'text-slate-200'} `}
                  >
                    {option.icon && (
                      <span
                        className={`flex-shrink-0 ${
                          value === option.value
                            ? 'text-emerald-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {option.icon}
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate font-medium">
                          {option.label}
                        </span>
                        {value === option.value && (
                          <Check className="ml-2 h-4 w-4 flex-shrink-0 text-emerald-400" />
                        )}
                      </div>
                      {option.description && (
                        <p className="mt-1 truncate text-xs text-slate-400">
                          {option.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
