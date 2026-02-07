/**
 * Autocomplete Component
 *
 * A searchable dropdown component for selecting from a list of options.
 */

'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { inputVariants } from '../primitives/variants';

export interface AutocompleteOption {
  value: string;
  label: string;
}

export interface AutocompleteProps {
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Autocomplete({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  className,
  disabled = false,
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Filter options based on search term
  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return options;

    return options.filter(
      option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.value.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  // Get selected option label
  const selectedLabel = React.useMemo(() => {
    const selectedOption = options.find(opt => opt.value === value);
    return selectedOption?.label || '';
  }, [options, value]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className={cn(
            inputVariants({ variant: 'default', size: 'md' }),
            'pr-10'
          )}
          placeholder={isOpen ? placeholder : selectedLabel || placeholder}
          value={isOpen ? searchTerm : selectedLabel}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          disabled={disabled}
          autoComplete="off"
        />
        <button
          type="button"
          className="text-muted hover:text-heading absolute top-1/2 right-3 -translate-y-1/2 disabled:opacity-50"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) {
              inputRef.current?.focus();
            }
          }}
          disabled={disabled}
        >
          <ChevronDown
            size={16}
            className={cn('transition-transform', isOpen && 'rotate-180')}
          />
        </button>
      </div>

      {isOpen && (
        <div className="border-divider-strong bg-surface-raised absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border-2 shadow-lg">
          {filteredOptions.length === 0 ? (
            <div className="text-body px-3 py-2 text-sm">No results found</div>
          ) : (
            <ul className="py-1">
              {filteredOptions.map(option => (
                <li key={option.value}>
                  <button
                    type="button"
                    className={cn(
                      'hover:bg-surface-hover flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors',
                      'text-heading font-medium',
                      option.value === value &&
                        'bg-accent-emerald-bg text-accent-emerald-text hover:bg-accent-emerald-bg-strong'
                    )}
                    onClick={() => handleSelect(option.value)}
                  >
                    <span>{option.label}</span>
                    {option.value === value && (
                      <Check size={16} className="text-emerald-600" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
