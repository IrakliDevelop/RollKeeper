'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string | number;
  label: string;
  description?: string;
}

interface FancySelectProps {
  options: Option[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  color?: 'blue' | 'purple' | 'emerald' | 'amber' | 'slate';
}

export const FancySelect: React.FC<FancySelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  className = '',
  disabled = false,
  color = 'blue'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  const colorStyles = {
    blue: {
      trigger: 'border-blue-300 focus:ring-blue-500 focus:border-blue-500',
      triggerOpen: 'border-blue-500 ring-2 ring-blue-500',
      dropdown: 'border-blue-200',
      option: 'hover:bg-blue-50',
      optionSelected: 'bg-blue-100 text-blue-900',
      checkIcon: 'text-blue-600'
    },
    purple: {
      trigger: 'border-purple-300 focus:ring-purple-500 focus:border-purple-500',
      triggerOpen: 'border-purple-500 ring-2 ring-purple-500',
      dropdown: 'border-purple-200',
      option: 'hover:bg-purple-50',
      optionSelected: 'bg-purple-100 text-purple-900',
      checkIcon: 'text-purple-600'
    },
    emerald: {
      trigger: 'border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500',
      triggerOpen: 'border-emerald-500 ring-2 ring-emerald-500',
      dropdown: 'border-emerald-200',
      option: 'hover:bg-emerald-50',
      optionSelected: 'bg-emerald-100 text-emerald-900',
      checkIcon: 'text-emerald-600'
    },
    amber: {
      trigger: 'border-amber-300 focus:ring-amber-500 focus:border-amber-500',
      triggerOpen: 'border-amber-500 ring-2 ring-amber-500',
      dropdown: 'border-amber-200',
      option: 'hover:bg-amber-50',
      optionSelected: 'bg-amber-100 text-amber-900',
      checkIcon: 'text-amber-600'
    },
    slate: {
      trigger: 'border-slate-300 focus:ring-slate-500 focus:border-slate-500',
      triggerOpen: 'border-slate-500 ring-2 ring-slate-500',
      dropdown: 'border-slate-200',
      option: 'hover:bg-slate-50',
      optionSelected: 'bg-slate-100 text-slate-900',
      checkIcon: 'text-slate-600'
    }
  };

  const styles = colorStyles[color];
  const selectedOption = options.find(option => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex(prev => 
            prev < options.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : options.length - 1
          );
          break;
        case 'Enter':
          event.preventDefault();
          if (highlightedIndex >= 0) {
            onChange(options[highlightedIndex].value);
            setIsOpen(false);
            setHighlightedIndex(-1);
          }
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, highlightedIndex, options, onChange]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && optionsRef.current) {
      const highlightedElement = optionsRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      setHighlightedIndex(-1);
    }
  };

  const handleOptionClick = (optionValue: string | number) => {
    onChange(optionValue);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full p-3 text-left bg-white border-2 rounded-lg transition-all duration-200
          flex items-center justify-between
          ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : 
            isOpen ? styles.triggerOpen : styles.trigger}
          ${disabled ? '' : 'hover:shadow-md'}
          focus:outline-none
          text-gray-900 font-medium
        `}
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          size={20} 
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${
            disabled ? 'text-gray-400' : 'text-gray-600'
          }`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className={`
          absolute z-50 mt-2 w-full bg-white border-2 ${styles.dropdown} rounded-lg shadow-xl
          max-h-60 overflow-y-auto
          animate-in fade-in-0 zoom-in-95 duration-100
        `}>
          <div ref={optionsRef}>
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isHighlighted = index === highlightedIndex;
              
              return (
                <div
                  key={option.value}
                  onClick={() => handleOptionClick(option.value)}
                  className={`
                    px-4 py-3 cursor-pointer transition-colors duration-150
                    flex items-center justify-between
                    ${isHighlighted ? styles.option : ''}
                    ${isSelected ? styles.optionSelected : 'text-gray-900'}
                    ${index === 0 ? 'rounded-t-md' : ''}
                    ${index === options.length - 1 ? 'rounded-b-md' : ''}
                    hover:shadow-sm
                  `}
                >
                  <div className="flex-1">
                    <div className="font-medium">{option.label}</div>
                    {option.description && (
                      <div className="text-sm text-gray-500 mt-1">{option.description}</div>
                    )}
                  </div>
                  {isSelected && (
                    <Check size={16} className={styles.checkIcon} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}; 