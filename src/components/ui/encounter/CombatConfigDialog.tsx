'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { SubTabs, type SubTabDefinition } from '@/components/ui/layout/SubTabs';
import { Input } from '@/components/ui/forms/input';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { Switch } from '@/components/ui/forms/switch';
import {
  RadioGroupField,
  RadioGroupItem,
} from '@/components/ui/forms/radio-group';
import { CustomConditionLibraryEditor } from '@/components/ui/encounter/custom-conditions/CustomConditionLibraryEditor';
import { useEncounterStore } from '@/store/encounterStore';
import {
  type CustomCondition,
  type EnemyHpDisplay,
  type EnemyConditionsDisplay,
  type HpStateBand,
  DEFAULT_HP_STATE_BANDS,
} from '@/types/encounter';
import {
  EMPTY_CUSTOM_CONDITIONS,
  cleanCustomConditions,
} from '@/utils/customConditions';

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
    description: 'Players see a word like "Bloodied" or "Critical".',
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

type ConfigSection = 'visibility' | 'conditions';

interface CombatConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DraftBand = HpStateBand & { draftId: string };

function toDraftBands(bands: HpStateBand[], prefix: string): DraftBand[] {
  return bands.map((band, index) => ({
    ...band,
    draftId: `${prefix}-${index}`,
  }));
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
  const [bands, setBands] = useState<DraftBand[]>(() =>
    toDraftBands(combatConfig.hpStateBands, 'initial')
  );
  const bandSequence = useRef(0);
  const addBandRef = useRef<HTMLButtonElement>(null);
  const returnBandFocus = useRef(false);
  const [customConditions, setCustomConditions] = useState<CustomCondition[]>(
    combatConfig.customConditions ?? EMPTY_CUSTOM_CONDITIONS
  );
  const [section, setSection] = useState<ConfigSection>('visibility');

  // Re-sync local state when dialog opens or store changes
  useEffect(() => {
    if (open) {
      setHpDisplay(combatConfig.enemyHpDisplay);
      setConditionsDisplay(combatConfig.enemyConditionsDisplay ?? 'off');
      setBands(
        toDraftBands(
          combatConfig.hpStateBands,
          `open-${++bandSequence.current}`
        )
      );
      setCustomConditions(
        combatConfig.customConditions ?? EMPTY_CUSTOM_CONDITIONS
      );
      setSection('visibility');
    }
  }, [open, combatConfig]);

  useEffect(() => {
    if (returnBandFocus.current) {
      addBandRef.current?.focus();
      returnBandFocus.current = false;
    }
  }, [bands]);

  const handleAddBand = () => {
    setBands(prev => [
      ...prev,
      { draftId: `added-${++bandSequence.current}`, minPercent: 0, label: '' },
    ]);
  };

  const handleRemoveBand = (index: number) => {
    setBands(prev => prev.filter((_, i) => i !== index));
    returnBandFocus.current = true;
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
    setBands(
      toDraftBands(DEFAULT_HP_STATE_BANDS, `reset-${++bandSequence.current}`)
    );
  };

  const handleSave = () => {
    const cleaned = bands
      .filter(b => b.label.trim() !== '')
      .map(({ minPercent, label }) => ({ minPercent, label }))
      .sort((a, b) => b.minPercent - a.minPercent);

    setCombatConfig({
      enemyHpDisplay: hpDisplay,
      hpStateBands: cleaned,
      enemyConditionsDisplay: conditionsDisplay,
      customConditions: cleanCustomConditions(customConditions),
    });
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const tabs: SubTabDefinition[] = [
    {
      value: 'visibility',
      id: 'combat-config-visibility',
      label: 'Player visibility',
      content: (
        <>
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
                  <div
                    key={band.draftId}
                    className="border-divider flex flex-wrap items-end gap-2 border-b pb-2"
                  >
                    <NumberInput
                      label={`Band ${index + 1} threshold (%)`}
                      value={band.minPercent}
                      onChange={v =>
                        setBands(prev =>
                          prev.map((b, i) =>
                            i === index ? { ...b, minPercent: v ?? 0 } : b
                          )
                        )
                      }
                      min={0}
                      max={100}
                      wrapperClassName="w-32 shrink-0"
                    />
                    <Input
                      type="text"
                      label={`Band ${index + 1} label`}
                      value={band.label}
                      onChange={e =>
                        handleBandChange(index, 'label', e.target.value)
                      }
                      placeholder="Wounded"
                      wrapperClassName="min-w-32 flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveBand(index)}
                      type="button"
                      aria-label={
                        band.label
                          ? `Remove ${band.label} band`
                          : `Remove band ${index + 1}`
                      }
                    >
                      <Trash2 size={14} className="text-muted" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                ref={addBandRef}
                variant="outline"
                size="sm"
                onClick={handleAddBand}
                type="button"
              >
                Add band
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
        </>
      ),
    },
    {
      value: 'conditions',
      id: 'combat-config-conditions',
      label: 'Custom conditions',
      content: (
        <CustomConditionLibraryEditor
          conditions={customConditions}
          onChange={setCustomConditions}
        />
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Combat configuration</DialogTitle>
          <DialogDescription>
            Controls what players see for enemy HP and conditions during combat.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          <SubTabs
            tabs={tabs}
            label="Combat configuration sections"
            value={section}
            onValueChange={value => setSection(value as ConfigSection)}
          />
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
