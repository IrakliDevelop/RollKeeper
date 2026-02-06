'use client';

import React, { useState, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Minus,
  Edit2,
  Check,
  X,
  Moon,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/forms';
import { Input } from '@/components/ui/forms';

interface DaysSpentTrackerProps {
  daysSpent: number;
  onUpdateDays: (days: number) => void;
  onIncrementDays: (amount?: number) => void;
  className?: string;
}

export default function DaysSpentTracker({
  daysSpent,
  onUpdateDays,
  onIncrementDays,
  className = '',
}: DaysSpentTrackerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const weeks = Math.floor(daysSpent / 7);
  const remainingDays = daysSpent % 7;

  const handleStartEdit = useCallback(() => {
    setEditValue(daysSpent.toString());
    setIsEditing(true);
  }, [daysSpent]);

  const handleConfirmEdit = useCallback(() => {
    const newValue = parseInt(editValue, 10);
    if (!isNaN(newValue) && newValue >= 0) {
      onUpdateDays(newValue);
    }
    setIsEditing(false);
  }, [editValue, onUpdateDays]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleConfirmEdit();
      } else if (e.key === 'Escape') {
        handleCancelEdit();
      }
    },
    [handleConfirmEdit, handleCancelEdit]
  );

  const handleQuickAdd = (amount: number) => {
    onIncrementDays(amount);
    setShowQuickAdd(false);
  };

  return (
    <div
      className={`border-accent-amber-border from-accent-amber-bg via-accent-orange-bg to-accent-amber-bg-strong rounded-xl border-2 bg-gradient-to-r p-4 shadow-md ${className}`}
    >
      {/* Main horizontal layout */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Left: Title + Day count */}
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 p-2.5 shadow-md">
            <Calendar size={22} className="text-white" />
          </div>

          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-accent-amber-text text-sm font-semibold">
                Campaign Days
              </h3>
              <p className="text-accent-amber-text-muted text-xs">
                {weeks > 0 ? (
                  <span>
                    {weeks} {weeks === 1 ? 'week' : 'weeks'}
                    {remainingDays > 0 &&
                      `, ${remainingDays} ${remainingDays === 1 ? 'day' : 'days'}`}
                  </span>
                ) : (
                  <span>
                    {daysSpent} {daysSpent === 1 ? 'day' : 'days'} elapsed
                  </span>
                )}
              </p>
            </div>

            {/* Day count display/edit */}
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-24 text-center text-xl font-bold"
                  autoFocus
                />
                <Button
                  onClick={handleConfirmEdit}
                  variant="success"
                  size="sm"
                  title="Confirm"
                >
                  <Check size={16} />
                </Button>
                <Button
                  onClick={handleCancelEdit}
                  variant="ghost"
                  size="sm"
                  title="Cancel"
                >
                  <X size={16} />
                </Button>
              </div>
            ) : (
              <div className="border-accent-amber-border-strong bg-surface-raised flex items-center gap-2 rounded-lg border-2 px-4 py-2 shadow-inner">
                <span className="text-accent-amber-text text-3xl font-bold">
                  {daysSpent}
                </span>
                <Button
                  onClick={handleStartEdit}
                  variant="ghost"
                  size="xs"
                  title="Edit days manually"
                  className="text-accent-amber-text-muted hover:bg-accent-amber-bg-strong"
                >
                  <Edit2 size={14} />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Center: Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            onClick={() => onIncrementDays(-1)}
            disabled={daysSpent === 0}
            variant="outline"
            size="sm"
            className="border-accent-amber-border-strong bg-surface-raised text-accent-amber-text-muted hover:bg-accent-amber-bg"
            title="Subtract 1 day"
          >
            <Minus size={16} />
          </Button>

          <Button
            onClick={() => onIncrementDays(1)}
            variant="secondary"
            size="sm"
            leftIcon={<Plus size={14} />}
            className="from-accent-amber-text-muted to-accent-orange-text-muted text-inverse hover:from-accent-amber-text hover:to-accent-orange-text bg-gradient-to-r"
            title="Add 1 day"
          >
            +1 Day
          </Button>

          <div className="relative">
            <Button
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              variant="outline"
              size="sm"
              className="border-accent-amber-border-strong bg-surface-raised text-accent-amber-text-muted hover:bg-accent-amber-bg"
              title="Quick add multiple days"
            >
              <Plus size={14} />
              <span className="ml-1">More</span>
            </Button>

            {/* Quick add dropdown - opens upward */}
            {showQuickAdd && (
              <div className="border-accent-amber-border bg-surface-raised absolute bottom-full left-0 z-10 mb-1 w-48 rounded-lg border p-2 shadow-lg">
                <p className="text-accent-amber-text mb-2 text-center text-xs font-medium">
                  Quick Add
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { amount: 3, label: '+3 days' },
                    { amount: 7, label: '+1 week' },
                    { amount: 14, label: '+2 weeks' },
                    { amount: 30, label: '+1 month' },
                  ].map(({ amount, label }) => (
                    <Button
                      key={amount}
                      onClick={() => handleQuickAdd(amount)}
                      variant="ghost"
                      size="xs"
                      className="text-accent-amber-text-muted hover:bg-accent-amber-bg-strong justify-center"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Info */}
        <div className="bg-accent-amber-bg-strong/50 flex items-center gap-2 rounded-lg px-3 py-2">
          <Info
            size={14}
            className="text-accent-amber-text-muted flex-shrink-0"
          />
          <p className="text-accent-amber-text-muted text-xs">
            <Moon
              size={10}
              className="text-accent-indigo-text-muted mr-1 inline"
            />
            Auto +1 on Long Rest
          </p>
        </div>
      </div>

      {/* Click outside to close quick add */}
      {showQuickAdd && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowQuickAdd(false)}
        />
      )}
    </div>
  );
}
