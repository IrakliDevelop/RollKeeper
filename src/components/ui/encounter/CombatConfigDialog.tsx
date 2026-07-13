'use client';

import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Switch } from '@/components/ui/forms/switch';
import {
  RadioGroupField,
  RadioGroupItem,
} from '@/components/ui/forms/radio-group';
import { useEncounterStore } from '@/store/encounterStore';
import {
  type EnemyHpDisplay,
  type EnemyConditionsDisplay,
  type HpStateBand,
  DEFAULT_HP_STATE_BANDS,
} from '@/types/encounter';

interface HpDisplayOption {
  value: EnemyHpDisplay;
  label: string;
  description: string;
}

const HP_DISPLAY_OPTIONS: HpDisplayOption[] = [
  {
    value: 'off',
    label: 'Off',
    description: 'Players see nothing — enemy HP is fully hidden.',
  },
  {
    value: 'label',
    label: 'State label',
    description: 'Players see a word like "Bloodied" or "Injured".',
  },
  {
    value: 'bar',
    label: 'HP bar',
    description: 'Players see a coloured HP bar without numbers.',
  },
  {
    value: 'percent',
    label: 'Percentage',
    description: 'Players see a number like "45%".',
  },
  {
    value: 'exact',
    label: 'Exact numbers',
    description: 'Players see the full value, e.g. "54 / 120".',
  },
];

interface CombatConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CombatConfigDialog({
  open,
  onOpenChange,
}: CombatConfigDialogProps) {
  const combatConfig = useEncounterStore(s => s.combatConfig);
  const setCombatConfig = useEncounterStore(s => s.setCombatConfig);

  const [hpDisplay, setHpDisplay] = useState<EnemyHpDisplay>(
    combatConfig.enemyHpDisplay
  );
  const [conditionsDisplay, setConditionsDisplay] =
    useState<EnemyConditionsDisplay>(
      combatConfig.enemyConditionsDisplay ?? 'off'
    );
  const [bands, setBands] = useState<HpStateBand[]>(combatConfig.hpStateBands);

  // Re-sync local state when dialog opens or store changes
  useEffect(() => {
    if (open) {
      setHpDisplay(combatConfig.enemyHpDisplay);
      setConditionsDisplay(combatConfig.enemyConditionsDisplay ?? 'off');
      setBands(combatConfig.hpStateBands);
    }
  }, [open, combatConfig]);

  const handleAddBand = () => {
    setBands(prev => [...prev, { minPercent: 0, label: '' }]);
  };

  const handleRemoveBand = (index: number) => {
    setBands(prev => prev.filter((_, i) => i !== index));
  };

  const handleBandChange = (
    index: number,
    field: keyof HpStateBand,
    value: string
  ) => {
    setBands(prev =>
      prev.map((band, i) => {
        if (i !== index) return band;
        if (field === 'minPercent') {
          const parsed = parseInt(value, 10);
          const clamped = isNaN(parsed)
            ? 0
            : Math.max(0, Math.min(100, parsed));
          return { ...band, minPercent: clamped };
        }
        return { ...band, label: value };
      })
    );
  };

  const handleResetBands = () => {
    setBands([...DEFAULT_HP_STATE_BANDS]);
  };

  const handleSave = () => {
    const cleaned = bands
      .filter(b => b.label.trim() !== '')
      .sort((a, b) => b.minPercent - a.minPercent);

    setCombatConfig({
      enemyHpDisplay: hpDisplay,
      hpStateBands: cleaned,
      enemyConditionsDisplay: conditionsDisplay,
    });
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Combat Configuration</DialogTitle>
          <DialogDescription>
            Controls what players see for enemy HP and conditions during combat.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* Enemy HP display picker */}
          <RadioGroupField
            label="Enemy HP display"
            value={hpDisplay}
            onValueChange={v => setHpDisplay(v as EnemyHpDisplay)}
          >
            <div className="space-y-2">
              {HP_DISPLAY_OPTIONS.map(opt => (
                <RadioGroupItem
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  description={opt.description}
                  variant="card"
                  size="sm"
                />
              ))}
            </div>
          </RadioGroupField>

          {/* HP state bands editor — only shown when display === 'label' */}
          {hpDisplay === 'label' && (
            <div className="space-y-3">
              <div className="border-divider flex items-center justify-between border-b pb-2">
                <span className="text-heading text-sm font-medium">
                  HP state labels
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetBands}
                  type="button"
                >
                  Reset to defaults
                </Button>
              </div>

              <p className="text-muted text-xs">
                Each band covers HP from its threshold up to the next band. Rows
                with empty labels are dropped on save.
              </p>

              <div className="space-y-2">
                {bands.map((band, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={band.minPercent.toString()}
                      onChange={e =>
                        handleBandChange(index, 'minPercent', e.target.value)
                      }
                      min={0}
                      max={100}
                      wrapperClassName="w-24 shrink-0"
                      aria-label="Minimum percent"
                    />
                    <span className="text-muted shrink-0 text-sm">%</span>
                    <Input
                      type="text"
                      value={band.label}
                      onChange={e =>
                        handleBandChange(index, 'label', e.target.value)
                      }
                      placeholder="Label..."
                      wrapperClassName="flex-1"
                      aria-label="Band label"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveBand(index)}
                      type="button"
                      aria-label="Remove band"
                    >
                      <Trash2 size={14} className="text-muted" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleAddBand}
                type="button"
              >
                + Add band
              </Button>
            </div>
          )}

          {/* Enemy conditions sharing */}
          <div className="border-divider border-t pt-4">
            <Switch
              checked={conditionsDisplay === 'on'}
              onCheckedChange={checked =>
                setConditionsDisplay(checked ? 'on' : 'off')
              }
              label="Share enemy conditions with players"
              description="Players see condition icons and concentration on enemy tokens. Your own party's conditions are always visible to them."
              wrapperClassName="gap-4"
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            size="md"
            onClick={handleCancel}
            type="button"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            type="button"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
