'use client';

import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import { DiceAppearance } from './dice-settings/DiceAppearance';
import { DiceBehavior } from './dice-settings/DiceBehavior';
import { DiceAdvanced } from './dice-settings/DiceAdvanced';
import { DicePreview } from './dice-settings/DicePreview';
import { DICE_PRESETS, diceSkinSignature } from './dice-settings/dicePresets';
import { DEFAULT_DICE_SET } from '@/utils/diceSet';
import type { CharacterDiceSet } from '@/types/dice';

export interface DiceSetEditorProps {
  value: CharacterDiceSet;
  onChange: (next: CharacterDiceSet) => void;
}

export function DiceSetEditor({ value, onChange }: DiceSetEditorProps) {
  return (
    <div className="grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.85fr)]">
      <div className="min-w-0 space-y-8">
        <Section
          heading="Choose a dice set"
          level={2}
          contentClassName="space-y-4"
        >
          <p className="type-small text-muted">
            Start with a set, then adjust its colors and finish. Your changes
            appear in the preview.
          </p>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            role="group"
            aria-label="Dice presets"
          >
            {DICE_PRESETS.map(preset => {
              const color =
                typeof preset.skin.color === 'string'
                  ? preset.skin.color
                  : preset.skin.color[0];
              return (
                <Button
                  key={preset.id}
                  selected={
                    diceSkinSignature(value.skin) ===
                    diceSkinSignature(preset.skin)
                  }
                  className="h-auto min-w-0 flex-col items-start gap-1 px-3 py-3 text-left whitespace-normal"
                  onClick={() =>
                    onChange({ ...value, skin: structuredClone(preset.skin) })
                  }
                >
                  <span
                    aria-hidden="true"
                    className="border-input-border mb-1 h-5 w-full rounded-sm border"
                    style={{ backgroundColor: color }}
                  />
                  <span className="type-ui">{preset.name}</span>
                  <span className="type-small text-muted">
                    {preset.description}
                  </span>
                </Button>
              );
            })}
          </div>
        </Section>
        <DiceAppearance value={value} onChange={onChange} />
        <DiceBehavior value={value} onChange={onChange} />
        <DiceAdvanced value={value} onChange={onChange} />
        <Button
          variant="ghost"
          onClick={() => onChange(structuredClone(DEFAULT_DICE_SET))}
        >
          Reset dice settings
        </Button>
      </div>
      <div className="order-first min-w-0 lg:sticky lg:top-[calc(var(--app-header-height,0px)+1rem)] lg:order-last">
        <Section heading="Try your dice" level={2}>
          <DicePreview value={value} />
        </Section>
      </div>
    </div>
  );
}
