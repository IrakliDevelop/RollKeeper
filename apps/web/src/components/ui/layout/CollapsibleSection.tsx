'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultExpanded?: boolean;
  persistKey?: string; // Key for localStorage persistence
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
  onToggle?: (isExpanded: boolean) => void;
  disabled?: boolean;
  badge?: React.ReactNode; // Optional badge/counter in header
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  defaultExpanded = true,
  persistKey,
  className = '',
  headerClassName = '',
  contentClassName = '',
  children,
  onToggle,
  disabled = false,
  badge,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Load persisted state on mount
  useEffect(() => {
    if (persistKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(`collapsible-${persistKey}`);
      if (saved !== null) {
        const savedState = JSON.parse(saved);
        setIsExpanded(savedState);
      }
    }
  }, [persistKey]);

  // Save state to localStorage when it changes
  useEffect(() => {
    if (persistKey && typeof window !== 'undefined') {
      localStorage.setItem(
        `collapsible-${persistKey}`,
        JSON.stringify(isExpanded)
      );
    }
  }, [isExpanded, persistKey]);

  const handleToggle = () => {
    if (disabled) return;

    const newState = !isExpanded;
    setIsExpanded(newState);
    onToggle?.(newState);
  };

  return (
    <div className={`overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={handleToggle}
        disabled={disabled}
        className={`hover:bg-opacity-80 focus:ring-opacity-50 flex w-full items-center justify-between p-4 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        } ${headerClassName}`}
        aria-expanded={isExpanded}
        aria-controls={
          persistKey ? `collapsible-content-${persistKey}` : undefined
        }
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown size={20} className="text-body" />
            ) : (
              <ChevronRight size={20} className="text-body" />
            )}
            {icon && <span className="text-xl">{icon}</span>}
            <h2 className="text-heading text-xl font-bold">{title}</h2>
          </div>
          {badge && <div className="ml-2">{badge}</div>}
        </div>
      </button>

      {/* Content */}
      <div
        id={persistKey ? `collapsible-content-${persistKey}` : undefined}
        className={`transition-all duration-300 ease-in-out ${
          isExpanded
            ? 'max-h-none opacity-100'
            : 'max-h-0 overflow-hidden opacity-0'
        }`}
      >
        <div className={`pt-4 ${contentClassName}`}>{children}</div>
      </div>
    </div>
  );
};

export default CollapsibleSection;
