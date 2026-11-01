import type { Skin } from 'pollyroll';
import { materialPresets } from 'pollyroll/render';
import { Checkbox } from '@/components/ui/forms/checkbox';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Section } from '@/components/ui/layout/section';
import { DiceSlider } from './DiceSlider';
import {
  capitalize,
  DICE_LABEL_STYLES,
  DICE_MATERIALS,
  DICE_PATTERNS,
} from './dicePresets';
import { clampDieScale, MAX_DIE_SCALE, MIN_DIE_SCALE } from '@/utils/diceSet';
import type { CharacterDiceSet } from '@/types/dice';

export function DiceAppearance({
  value,
  onChange,
}: {
  value: CharacterDiceSet;
  onChange: (value: CharacterDiceSet) => void;
}) {
  const { skin } = value;
  const edit = (patch: Partial<Skin>) =>
    onChange({ ...value, skin: { ...skin, ...patch } });
  const [first, second] =
    typeof skin.color === 'string' ? [skin.color, skin.color] : skin.color;
  const twoTone = Array.isArray(skin.color);
  return (
    <Section heading="Dice appearance" level={2} contentClassName="space-y-5">
      <DiceSlider
        label="Dice size"
        min={MIN_DIE_SCALE}
        max={MAX_DIE_SCALE}
        value={value.dieScale}
        displayValue={`${value.dieScale.toFixed(2)}×`}
        onChange={next => onChange({ ...value, dieScale: clampDieScale(next) })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          type="color"
          label="Dice color"
          value={first}
          onChange={event =>
            edit({
              color: twoTone
                ? [event.target.value, second]
                : event.target.value,
            })
          }
        />
        <Input
          type="color"
          label="Number color"
          value={skin.labelColor}
          onChange={event => edit({ labelColor: event.target.value })}
        />
        <SelectField
          label="Material"
          value={typeof skin.material === 'string' ? skin.material : 'custom'}
          onValueChange={next => {
            if (next === 'custom')
              edit({
                material: {
                  ...materialPresets[
                    typeof skin.material === 'string'
                      ? skin.material
                      : 'plastic'
                  ],
                },
              });
            else {
              const material = DICE_MATERIALS.find(item => item === next);
              if (material) edit({ material });
            }
          }}
        >
          {DICE_MATERIALS.map(item => (
            <SelectItem key={item} value={item}>
              {capitalize(item)}
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom finish</SelectItem>
        </SelectField>
        <SelectField
          label="Pattern"
          value={typeof skin.pattern === 'string' ? skin.pattern : 'none'}
          onValueChange={next => {
            const pattern = DICE_PATTERNS.find(item => item === next);
            if (pattern) edit({ pattern });
          }}
        >
          {DICE_PATTERNS.map(item => (
            <SelectItem key={item} value={item}>
              {capitalize(item)}
            </SelectItem>
          ))}
        </SelectField>
        <SelectField
          label="Number style"
          value={skin.labelStyle ?? 'engraved'}
          onValueChange={next => {
            const labelStyle = DICE_LABEL_STYLES.find(item => item === next);
            if (labelStyle) edit({ labelStyle });
          }}
        >
          {DICE_LABEL_STYLES.map(item => (
            <SelectItem key={item} value={item}>
              {capitalize(item)}
            </SelectItem>
          ))}
        </SelectField>
        <SelectField
          label="Number font"
          value={skin.font ?? 'system-ui'}
          onValueChange={font => edit({ font })}
        >
          {[
            ['system-ui', 'Simple'],
            ['Georgia', 'Serif'],
            ['monospace', 'Monospace'],
            ...(skin.font &&
            !['system-ui', 'Georgia', 'monospace'].includes(skin.font)
              ? [[skin.font, skin.font]]
              : []),
          ].map(([id, label]) => (
            <SelectItem key={id} value={id}>
              {label}
            </SelectItem>
          ))}
        </SelectField>
      </div>
      <Checkbox
        label="Use two colors"
        checked={twoTone}
        onCheckedChange={checked =>
          edit({ color: checked === true ? [first, second] : first })
        }
      />
      {twoTone && (
        <Input
          type="color"
          label="Second dice color"
          value={second}
          onChange={event => edit({ color: [first, event.target.value] })}
        />
      )}
    </Section>
  );
}
