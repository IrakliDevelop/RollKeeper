'use client';

import { useEffect, useRef, useState } from 'react';
import {
  amethyst,
  aquamarine,
  brass,
  classic,
  emerald,
  materialPresets,
  oak,
  obsidian,
  ruby,
  sapphire,
  smoke,
  topaz,
} from 'pollyroll/render';
import type { MaterialPreset, Skin } from 'pollyroll';
import { Button } from '@/components/ui/forms/button';
import { Checkbox } from '@/components/ui/forms/checkbox';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Textarea } from '@/components/ui/forms/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/layout/card';
import type { CharacterDiceSet } from '@/types/dice';
import {
  MAX_DIE_SCALE,
  MIN_DIE_SCALE,
  clampDieScale,
  parseDiceSet,
} from '@/utils/diceSet';

const PRESETS = [
  ['classic', classic],
  ['obsidian', obsidian],
  ['brass', brass],
  ['oak', oak],
  ['sapphire', sapphire],
  ['ruby', ruby],
  ['emerald', emerald],
  ['amethyst', amethyst],
  ['topaz', topaz],
  ['aquamarine', aquamarine],
  ['smoke', smoke],
] as const;

const MATERIALS: readonly MaterialPreset[] = [
  'plastic',
  'metal',
  'wood',
  'glass',
  'stone',
  'gem',
];
const LABEL_STYLES = ['engraved', 'printed', 'embossed'] as const;
const PATTERNS = [
  'none',
  'gradient',
  'speckle',
  'marble',
  'wood',
  'swirl',
] as const;
const MATERIAL_FIELDS = [
  ['metalness', 'Metalness'],
  ['roughness', 'Roughness'],
  ['clearcoat', 'Clearcoat'],
  ['transmission', 'Transmission'],
  ['tint', 'Tint'],
  ['sparkle', 'Sparkle'],
] as const;

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function copyPreset(skin: Skin): Skin {
  return {
    ...skin,
    color:
      typeof skin.color === 'string'
        ? skin.color
        : [skin.color[0], skin.color[1]],
    material:
      typeof skin.material === 'string' ? skin.material : { ...skin.material },
  };
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-body block text-sm">
      <span className="mb-1 flex items-center justify-between">
        <span>{label}</span>
        <span className="text-muted tabular-nums">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={event => onChange(Number(event.target.value))}
        className="w-full"
      />
    </label>
  );
}

export interface DiceSetEditorProps {
  value: CharacterDiceSet;
  onChange: (next: CharacterDiceSet) => void;
  onPreview?: () => void;
}

export function DiceSetEditor({
  value,
  onChange,
  onPreview,
}: DiceSetEditorProps) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(() => JSON.stringify(value));
  const [preset, setPreset] = useState('classic');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const timer = useRef(0);
  const pending = useRef(false);
  const incoming = JSON.stringify(value);

  if (!pending.current && incoming !== seen) {
    setSeen(incoming);
    setDraft(value);
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const commit = (next: CharacterDiceSet) => {
    setDraft(next);
    pending.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      pending.current = false;
      onChange(next);
    }, 150);
  };

  const editSkin = (patch: Partial<Skin>) => {
    const skin: Skin = { ...draft.skin, ...patch };
    if ('font' in patch && !patch.font) delete skin.font;
    commit({ ...draft, skin });
  };

  const skin = draft.skin;
  const [colorA, colorB] =
    typeof skin.color === 'string' ? [skin.color, skin.color] : skin.color;
  const twoTone = typeof skin.color !== 'string';
  const materialValue =
    typeof skin.material === 'string' ? skin.material : 'custom';
  const materialParams =
    typeof skin.material === 'object' ? skin.material : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dice set</CardTitle>
        <CardDescription>
          Color, material, and size for this character&apos;s dice. Rolls on
          this sheet use the set.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Start from"
            value={preset}
            onValueChange={name => {
              const match = PRESETS.find(([id]) => id === name);
              if (!match) return;
              setPreset(name);
              commit({ ...draft, skin: copyPreset(match[1]) });
            }}
          >
            {PRESETS.map(([id]) => (
              <SelectItem key={id} value={id}>
                {titleCase(id)}
              </SelectItem>
            ))}
          </SelectField>
          <SelectField
            label="Material"
            value={materialValue}
            onValueChange={name => {
              if (name === 'custom') {
                const base =
                  typeof skin.material === 'string' ? skin.material : 'plastic';
                editSkin({ material: { ...materialPresets[base] } });
                return;
              }
              const named = MATERIALS.find(item => item === name);
              if (named) editSkin({ material: named });
            }}
          >
            {MATERIALS.map(item => (
              <SelectItem key={item} value={item}>
                {titleCase(item)}
              </SelectItem>
            ))}
            <SelectItem value="custom">Custom</SelectItem>
          </SelectField>
          <Input
            type="color"
            label="Color"
            value={colorA}
            onChange={event =>
              editSkin({
                color: twoTone
                  ? [event.target.value, colorB]
                  : event.target.value,
              })
            }
          />
          <Input
            type="color"
            label="Label color"
            value={skin.labelColor}
            onChange={event => editSkin({ labelColor: event.target.value })}
          />
          <Checkbox
            label="Two-tone"
            checked={twoTone}
            onCheckedChange={checked =>
              editSkin({
                color: checked === true ? [colorA, colorB] : colorA,
              })
            }
          />
          {twoTone && (
            <Input
              type="color"
              label="Second color"
              value={colorB}
              onChange={event =>
                editSkin({ color: [colorA, event.target.value] })
              }
            />
          )}
          <SelectField
            label="Label style"
            value={skin.labelStyle ?? 'engraved'}
            onValueChange={style => {
              const named = LABEL_STYLES.find(item => item === style);
              if (named) editSkin({ labelStyle: named });
            }}
          >
            {LABEL_STYLES.map(item => (
              <SelectItem key={item} value={item}>
                {titleCase(item)}
              </SelectItem>
            ))}
          </SelectField>
          <SelectField
            label="Pattern"
            value={typeof skin.pattern === 'string' ? skin.pattern : 'none'}
            onValueChange={pattern => {
              const named = PATTERNS.find(item => item === pattern);
              if (named) editSkin({ pattern: named });
            }}
          >
            {PATTERNS.map(item => (
              <SelectItem key={item} value={item}>
                {titleCase(item)}
              </SelectItem>
            ))}
          </SelectField>
          <Input
            label="Font"
            value={skin.font ?? ''}
            placeholder="system-ui"
            onChange={event => editSkin({ font: event.target.value })}
          />
        </div>

        {materialParams && (
          <div className="grid gap-3 sm:grid-cols-2">
            {MATERIAL_FIELDS.map(([key, label]) => (
              <SliderField
                key={key}
                label={label}
                min={0}
                max={1}
                step={0.01}
                value={materialParams[key] ?? 0}
                onChange={next =>
                  editSkin({
                    material: { ...materialParams, [key]: next },
                  })
                }
              />
            ))}
          </div>
        )}

        <SliderField
          label="Size"
          min={MIN_DIE_SCALE}
          max={MAX_DIE_SCALE}
          step={0.05}
          value={draft.dieScale}
          onChange={next => commit({ ...draft, dieScale: clampDieScale(next) })}
        />

        <div className="flex flex-wrap gap-2">
          {onPreview && (
            <Button type="button" variant="secondary" onClick={onPreview}>
              Preview roll
            </Button>
          )}
        </div>

        <details className="border-divider rounded-lg border p-3">
          <summary className="text-heading cursor-pointer text-sm font-medium">
            Import or export
          </summary>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <Textarea
                label="Dice set JSON"
                readOnly
                rows={8}
                value={JSON.stringify(draft, null, 2)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    JSON.stringify(draft, null, 2)
                  );
                }}
              >
                Copy
              </Button>
            </div>
            <div className="space-y-2">
              <Textarea
                label="Import"
                rows={8}
                value={importText}
                error={importError || undefined}
                onChange={event => setImportText(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  let parsed: unknown;
                  try {
                    parsed = JSON.parse(importText);
                  } catch {
                    setImportError('That is not valid JSON.');
                    return;
                  }
                  const diceSet = parseDiceSet(parsed);
                  if (!diceSet) {
                    setImportError(
                      'Not a valid dice set. Colors must be #rrggbb, and custom shaders are not saved on a character.'
                    );
                    return;
                  }
                  setImportError('');
                  pending.current = false;
                  window.clearTimeout(timer.current);
                  setDraft(diceSet);
                  onChange(diceSet);
                }}
              >
                Load
              </Button>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
