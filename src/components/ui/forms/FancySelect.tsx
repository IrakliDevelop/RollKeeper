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
  color = 'blue',
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
      checkIcon: 'text-blue-600',
    },
    purple: {
      trigger:
        'border-purple-300 focus:ring-purple-500 focus:border-purple-500',
      triggerOpen: 'border-purple-500 ring-2 ring-purple-500',
      dropdown: 'border-purple-200',
      option: 'hover:bg-purple-50',
      optionSelected: 'bg-purple-100 text-purple-900',
      checkIcon: 'text-purple-600',
    },
    emerald: {
      trigger:
        'border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500',
      triggerOpen: 'border-emerald-500 ring-2 ring-emerald-500',
      dropdown: 'border-emerald-200',
      option: 'hover:bg-emerald-50',
      optionSelected: 'bg-emerald-100 text-emerald-900',
      checkIcon: 'text-emerald-600',
    },
    amber: {
      trigger: 'border-amber-300 focus:ring-amber-500 focus:border-amber-500',
      triggerOpen: 'border-amber-500 ring-2 ring-amber-500',
      dropdown: 'border-amber-200',
      option: 'hover:bg-amber-50',
      optionSelected: 'bg-amber-100 text-amber-900',
      checkIcon: 'text-amber-600',
    },
    slate: {
      trigger: 'border-slate-300 focus:ring-slate-500 focus:border-slate-500',
      triggerOpen: 'border-slate-500 ring-2 ring-slate-500',
      dropdown: 'border-slate-200',
      option: 'hover:bg-slate-50',
      optionSelected: 'bg-slate-100 text-slate-900',
      checkIcon: 'text-slate-600',
    },
  };

  const styles = colorStyles[color];
  const selectedOption = options.find(option => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
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
      const highlightedElement = optionsRef.current.children[
        highlightedIndex
      ] as HTMLElement;
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
        className={`bg-surface-raised flex w-full items-center justify-between rounded-lg border-2 p-3 text-left transition-all duration-200 ${
          disabled
            ? 'border-divider bg-surface-secondary text-faint cursor-not-allowed'
            : isOpen
              ? styles.triggerOpen
              : styles.trigger
        } ${disabled ? '' : 'hover:shadow-md'} text-heading font-medium focus:outline-none`}
      >
        <span className={selectedOption ? 'text-heading' : 'text-muted'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={20}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${
            disabled ? 'text-faint' : 'text-body'
          }`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div
          className={`bg-surface-raised absolute z-50 mt-2 w-full border-2 ${styles.dropdown} animate-in fade-in-0 zoom-in-95 max-h-60 overflow-y-auto rounded-lg shadow-xl duration-100`}
        >
          <div ref={optionsRef}>
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isHighlighted = index === highlightedIndex;

              return (
                <div
                  key={option.value}
                  onClick={() => handleOptionClick(option.value)}
                  className={`flex cursor-pointer items-center justify-between px-4 py-3 transition-colors duration-150 ${isHighlighted ? styles.option : ''} ${isSelected ? styles.optionSelected : 'text-heading'} ${index === 0 ? 'rounded-t-md' : ''} ${index === options.length - 1 ? 'rounded-b-md' : ''} hover:shadow-sm`}
                >
                  <div className="flex-1">
                    <div className="font-medium">{option.label}</div>
                    {option.description && (
                      <div className="text-muted mt-1 text-sm">
                        {option.description}
                      </div>
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
