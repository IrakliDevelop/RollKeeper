import { Switch } from '@/components/ui/forms/switch';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Section } from '@/components/ui/layout/section';
import { DiceSlider } from './DiceSlider';
import type { CharacterDiceSet, DicePreferences } from '@/types/dice';

export function DiceBehavior({
  value,
  onChange,
}: {
  value: CharacterDiceSet;
  onChange: (value: CharacterDiceSet) => void;
}) {
  const options = value.options ?? {};
  const edit = (patch: DicePreferences) =>
    onChange({ ...value, options: { ...options, ...patch } });
  return (
    <Section heading="Sound and motion" level={2} contentClassName="space-y-5">
      <DiceSlider
        label="Dice volume"
        value={options.sound ?? 0}
        displayValue={
          options.sound ? `${Math.round(options.sound * 100)}%` : 'Off'
        }
        description="Recorded dice clacks play when you roll. Previews stay silent until you press Roll preview."
        onChange={sound => edit({ sound })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Roll motion"
          value={options.reducedMotion ?? 'auto'}
          onValueChange={next => {
            if (next === 'auto' || next === 'always' || next === 'never')
              edit({ reducedMotion: next });
          }}
        >
          <SelectItem value="auto">Follow device settings</SelectItem>
          <SelectItem value="always">Show results immediately</SelectItem>
          <SelectItem value="never">Animate rolls</SelectItem>
        </SelectField>
        <SelectField
          label="Clear dice after"
          value={
            options.fadeAfterMs === null
              ? 'keep'
              : String(options.fadeAfterMs ?? 1000)
          }
          onValueChange={next =>
            edit({ fadeAfterMs: next === 'keep' ? null : Number(next) })
          }
        >
          <SelectItem value="1000">1 second</SelectItem>
          <SelectItem value="3000">3 seconds</SelectItem>
          <SelectItem value="8000">8 seconds</SelectItem>
          <SelectItem value="keep">Keep until the next roll</SelectItem>
          {options.fadeAfterMs != null &&
            ![1000, 3000, 8000].includes(options.fadeAfterMs) && (
              <SelectItem value={String(options.fadeAfterMs)}>
                {options.fadeAfterMs / 1000} seconds
              </SelectItem>
            )}
        </SelectField>
        <SelectField
          label="Display quality"
          value={String(options.maxDpr ?? 2)}
          onValueChange={next => edit({ maxDpr: Number(next) })}
        >
          <SelectItem value="2">Sharper dice</SelectItem>
          <SelectItem value="1">Save battery</SelectItem>
          {options.maxDpr != null &&
            options.maxDpr !== 1 &&
            options.maxDpr !== 2 && (
              <SelectItem value={String(options.maxDpr)}>
                Custom ({options.maxDpr}×)
              </SelectItem>
            )}
        </SelectField>
      </div>
      <Switch
        label="Dice shadows"
        checked={options.shadows ?? true}
        onCheckedChange={shadows => edit({ shadows })}
      />
      <Switch
        label="Announce roll results"
        description="Read settled results aloud with your screen reader."
        checked={options.announce ?? false}
        onCheckedChange={announce => edit({ announce })}
      />
    </Section>
  );
}
