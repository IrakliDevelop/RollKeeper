'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/forms';

interface RestManagerProps {
  onShortRest: () => void;
  onLongRest: () => void;
  onShowShortRestToast?: () => void;
  onShowLongRestToast?: () => void;
  className?: string;
}

export default function RestManager({
  onShortRest,
  onLongRest,
  onShowShortRestToast,
  onShowLongRestToast,
  className = '',
}: RestManagerProps) {
  const handleShortRest = () => {
    onShortRest();
    onShowShortRestToast?.();
  };

  const handleLongRest = () => {
    onLongRest();
    onShowLongRestToast?.();
  };

  return (
    <div className={className}>
      <p className="text-body mb-4 text-sm">
        Take a rest to restore your character&apos;s resources, abilities, and
        hit points.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Short Rest */}
        <div className="border-accent-blue-border flex flex-col rounded-lg border-2 bg-gradient-to-br from-[var(--gradient-blue-from)] to-[var(--gradient-blue-to)] p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 p-2 shadow-md">
              <Sun size={20} className="text-white" />
            </div>
            <h4 className="text-accent-blue-text text-lg font-semibold">
              Short Rest
            </h4>
          </div>

          <div className="text-accent-blue-text mb-4 flex-1 space-y-1 text-xs">
            <p>• Restores short rest abilities</p>
            <p>• Restores Pact Magic slots (Warlock)</p>
            <p>• Resets reaction usage</p>
            <p>• Spend Hit Dice to heal (manual)</p>
          </div>

          <Button
            onClick={handleShortRest}
            fullWidth
            variant="secondary"
            size="md"
            leftIcon={<Sun className="h-4 w-4" />}
            className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700"
          >
            Take Short Rest
          </Button>
        </div>

        {/* Long Rest */}
        <div className="border-accent-indigo-border flex flex-col rounded-lg border-2 bg-gradient-to-br from-[var(--gradient-indigo-from)] to-[var(--gradient-purple-to)] p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 p-2 shadow-md">
              <Moon size={20} className="text-white" />
            </div>
            <h4 className="text-accent-indigo-text text-lg font-semibold">
              Long Rest
            </h4>
          </div>

          <div className="text-accent-indigo-text mb-4 flex-1 space-y-1 text-xs">
            <p>• Restores ALL abilities</p>
            <p>• Restores ALL spell slots</p>
            <p>• Restores ALL hit dice</p>
            <p>• Heals to full HP</p>
            <p>• Clears temp HP & temp AC</p>
            <p>• Resets reaction & death saves</p>
          </div>

          <Button
            onClick={handleLongRest}
            fullWidth
            variant="secondary"
            size="md"
            leftIcon={<Moon className="h-4 w-4" />}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
          >
            Take Long Rest
          </Button>
        </div>
      </div>

      <div className="border-accent-amber-border mt-4 rounded-lg border bg-gradient-to-r from-[var(--gradient-amber-from)] to-[var(--gradient-amber-to)] p-3">
        <p className="text-accent-amber-text text-xs">
          <strong>Note:</strong> Individual reset buttons in each section still
          work independently if you need fine-grained control.
        </p>
      </div>
    </div>
  );
}
