'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Checkbox } from '@/components/ui/forms/checkbox';
import RichTextEditor from '@/components/ui/forms/RichTextEditor';
import {
  SPELL_SCHOOLS,
  CASTING_TIMES,
  RANGES,
  DURATIONS,
  ACTION_TYPES,
  SAVING_THROWS,
  DAMAGE_TYPES,
} from '@/utils/spellConstants';
import type { SpellFormData, FreeCastMode } from '@/utils/spellConversion';
import type { SpellActionType } from '@/types/character';

export interface SpellFormFieldsProps {
  formData: SpellFormData;
  onChange: (data: SpellFormData) => void;
  /** Show Prepared / Always Prepared checkboxes (player sheet only). Default: false */
  showPreparedOptions?: boolean;
  /** Current tags on the spell */
  tags?: string[];
  /** Called when tags change. If omitted, the Tags section is hidden. */
  onTagsChange?: (tags: string[]) => void;
  /** Existing tags on the NPC for autocomplete suggestions */
  existingTags?: string[];
}

export function SpellFormFields({
  formData,
  onChange,
  showPreparedOptions = false,
  tags,
  onTagsChange,
  existingTags = [],
}: SpellFormFieldsProps) {
  const set = (patch: Partial<SpellFormData>) =>
    onChange({ ...formData, ...patch });

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h4 className="border-divider text-heading border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
          Basic Information
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Spell Name"
            value={formData.name}
            onChange={e => set({ name: e.target.value })}
            required
            placeholder="Enter spell name"
          />
          <div>
            <label className="text-body mb-2 block text-sm font-medium">
              Level
            </label>
            <SelectField
              value={formData.level.toString()}
              onValueChange={value => set({ level: parseInt(value) })}
            >
              <SelectItem value="0">Cantrip</SelectItem>
              {Array.from({ length: 9 }, (_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  Level {i + 1}
                </SelectItem>
              ))}
            </SelectField>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-body mb-2 block text-sm font-medium">
              School
            </label>
            <SelectField
              value={formData.school}
              onValueChange={value => set({ school: value })}
            >
              {SPELL_SCHOOLS.map(school => (
                <SelectItem key={school} value={school}>
                  {school}
                </SelectItem>
              ))}
            </SelectField>
          </div>
          <Input
            label="Source"
            value={formData.source}
            onChange={e => set({ source: e.target.value })}
            placeholder="e.g., PHB, XGE, TCE"
          />
        </div>
      </div>

      {/* Casting Details */}
      <div className="space-y-4">
        <h4 className="border-divider text-heading border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
          Casting Details
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="text-body mb-2 block text-sm font-medium">
              Casting Time
            </label>
            <SelectField
              value={formData.castingTime}
              onValueChange={value => set({ castingTime: value })}
            >
              {CASTING_TIMES.map(time => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectField>
          </div>
          <div>
            <label className="text-body mb-2 block text-sm font-medium">
              Range
            </label>
            <SelectField
              value={formData.range}
              onValueChange={value => set({ range: value })}
            >
              {RANGES.map(range => (
                <SelectItem key={range} value={range}>
                  {range}
                </SelectItem>
              ))}
            </SelectField>
          </div>
          <div>
            <label className="text-body mb-2 block text-sm font-medium">
              Duration
            </label>
            <SelectField
              value={formData.duration}
              onValueChange={value => set({ duration: value })}
            >
              {DURATIONS.map(duration => (
                <SelectItem key={duration} value={duration}>
                  {duration}
                </SelectItem>
              ))}
            </SelectField>
          </div>
        </div>
      </div>

      {/* Components */}
      <div className="space-y-4">
        <h4 className="border-divider text-heading border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
          Components
        </h4>
        <div className="flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={formData.components.verbal}
              onCheckedChange={checked =>
                set({
                  components: {
                    ...formData.components,
                    verbal: checked as boolean,
                  },
                })
              }
            />
            <span className="text-heading text-sm font-medium">Verbal (V)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={formData.components.somatic}
              onCheckedChange={checked =>
                set({
                  components: {
                    ...formData.components,
                    somatic: checked as boolean,
                  },
                })
              }
            />
            <span className="text-heading text-sm font-medium">
              Somatic (S)
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={formData.components.material}
              onCheckedChange={checked =>
                set({
                  components: {
                    ...formData.components,
                    material: checked as boolean,
                  },
                })
              }
            />
            <span className="text-heading text-sm font-medium">
              Material (M)
            </span>
          </label>
        </div>
        {formData.components.material && (
          <Input
            label="Material Component Description"
            value={formData.components.materialDescription}
            onChange={e =>
              set({
                components: {
                  ...formData.components,
                  materialDescription: e.target.value,
                },
              })
            }
            placeholder="Describe the material components..."
          />
        )}
      </div>

      {/* Spell Properties */}
      <div className="space-y-4">
        <h4 className="border-divider text-heading border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
          Spell Properties
        </h4>
        <div className="flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={formData.ritual}
              onCheckedChange={checked => set({ ritual: checked as boolean })}
            />
            <span className="text-heading text-sm font-medium">Ritual</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={formData.concentration}
              onCheckedChange={checked =>
                set({ concentration: checked as boolean })
              }
            />
            <span className="text-heading text-sm font-medium">
              Concentration
            </span>
          </label>
          {showPreparedOptions && (
            <>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={formData.isPrepared}
                  onCheckedChange={checked =>
                    set({ isPrepared: checked as boolean })
                  }
                />
                <span className="text-heading text-sm font-medium">
                  Prepared
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={formData.isAlwaysPrepared}
                  onCheckedChange={checked =>
                    set({ isAlwaysPrepared: checked as boolean })
                  }
                />
                <span className="text-heading text-sm font-medium">
                  Always Prepared
                </span>
              </label>
            </>
          )}
        </div>
      </div>

      {/* Casting Source */}
      <div className="space-y-4">
        <h4 className="border-divider text-heading border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
          Casting Source
        </h4>
        <Input
          label="Source / Origin"
          value={formData.castingSource}
          onChange={e => set({ castingSource: e.target.value })}
          placeholder='e.g. "Fey Touched", "Drow Magic", "Eldritch Invocation"'
          helperText="Where this spell comes from (feat, race, background, etc.)"
        />
        <div>
          <label className="text-body mb-2 block text-sm font-medium">
            Free Casting
          </label>
          <SelectField
            value={formData.freeCastMode}
            onValueChange={value =>
              set({ freeCastMode: value as FreeCastMode })
            }
          >
            <SelectItem value="normal">Normal (uses spell slot)</SelectItem>
            <SelectItem value="at_will">
              At Will (no slot needed, unlimited)
            </SelectItem>
            <SelectItem value="innate">
              Innate (limited free casts per long rest)
            </SelectItem>
          </SelectField>
          <p className="text-muted mt-1 text-xs">
            {formData.freeCastMode === 'normal' &&
              'Standard spellcasting — always uses a spell slot.'}
            {formData.freeCastMode === 'at_will' &&
              'Can always be cast without using a spell slot.'}
            {formData.freeCastMode === 'innate' &&
              'Can be cast a limited number of times for free per long rest, then requires a slot.'}
          </p>
        </div>
        {formData.freeCastMode === 'innate' && (
          <Input
            label="Free Casts per Long Rest"
            type="number"
            value={formData.freeCastMax.toString()}
            onChange={e =>
              set({ freeCastMax: Math.max(1, parseInt(e.target.value) || 1) })
            }
            min={1}
            max={10}
            helperText="How many times this spell can be cast without a slot before needing a long rest"
          />
        )}
      </div>

      {/* Tags (shown only when onTagsChange is provided) */}
      {onTagsChange && tags !== undefined && (
        <SpellTagEditor
          tags={tags}
          onTagsChange={onTagsChange}
          existingTags={existingTags}
        />
      )}

      {/* Description */}
      <div className="space-y-4">
        <h4 className="border-divider text-heading border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
          Description
        </h4>
        <div>
          <label className="text-body mb-2 block text-sm font-medium">
            Spell Description *
          </label>
          <RichTextEditor
            content={formData.description}
            onChange={content => set({ description: content })}
            placeholder="Describe what the spell does..."
            minHeight="150px"
          />
        </div>
        <div>
          <label className="text-body mb-2 block text-sm font-medium">
            At Higher Levels
          </label>
          <RichTextEditor
            content={formData.higherLevel}
            onChange={content => set({ higherLevel: content })}
            placeholder="Describe what happens when cast at higher levels..."
            minHeight="100px"
          />
        </div>
      </div>

      {/* Combat Details */}
      <div className="space-y-4">
        <h4 className="border-divider text-heading border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
          Combat Details
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-body mb-2 block text-sm font-medium">
              Action Type
            </label>
            <SelectField
              value={formData.actionType || '__none__'}
              onValueChange={value =>
                set({
                  actionType: (value === '__none__' ? '' : value) as
                    | SpellActionType
                    | '',
                })
              }
            >
              {ACTION_TYPES.map(type => (
                <SelectItem
                  key={type.value || '__none__'}
                  value={type.value || '__none__'}
                >
                  {type.label}
                </SelectItem>
              ))}
            </SelectField>
          </div>
          {formData.actionType === 'save' && (
            <div>
              <label className="text-body mb-2 block text-sm font-medium">
                Saving Throw
              </label>
              <SelectField
                value={formData.savingThrow || '__none__'}
                onValueChange={value =>
                  set({ savingThrow: value === '__none__' ? '' : value })
                }
              >
                <SelectItem value="__none__" disabled>
                  Select...
                </SelectItem>
                {SAVING_THROWS.map(save => (
                  <SelectItem key={save} value={save}>
                    {save}
                  </SelectItem>
                ))}
              </SelectField>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Damage Dice"
            value={formData.damage}
            onChange={e => set({ damage: e.target.value })}
            placeholder="e.g., 1d8, 3d6"
          />
          {formData.damage && (
            <div>
              <label className="text-body mb-2 block text-sm font-medium">
                Damage Type
              </label>
              <SelectField
                value={formData.damageType || '__none__'}
                onValueChange={value =>
                  set({ damageType: value === '__none__' ? '' : value })
                }
              >
                <SelectItem value="__none__" disabled>
                  Select...
                </SelectItem>
                {DAMAGE_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectField>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- SpellTagEditor (private helper) ---- */

function SpellTagEditor({
  tags,
  onTagsChange,
  existingTags,
}: {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  existingTags: string[];
}) {
  const [tagInput, setTagInput] = useState('');
  const suggestions = existingTags.filter(
    t => !tags.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase())
  );
  const showSuggestions = tagInput.length > 0 && suggestions.length > 0;

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => onTagsChange(tags.filter(t => t !== tag));

  return (
    <div className="space-y-4">
      <h4 className="border-divider text-heading border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
        Tags
      </h4>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(tag => (
            <span
              key={tag}
              className="border-accent-amber-border bg-accent-amber-bg text-accent-amber-text inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:text-accent-red-text"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && tagInput.trim()) {
              e.preventDefault();
              addTag(tagInput);
            }
          }}
          placeholder="Add tag..."
          className="border-divider bg-surface-raised text-body placeholder:text-faint w-full rounded-md border px-3 py-1.5 text-sm"
        />
        {showSuggestions && (
          <div className="bg-surface-raised border-divider absolute top-full right-0 left-0 z-10 mt-1 overflow-hidden rounded-md border shadow-lg">
            {suggestions.slice(0, 5).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => addTag(s)}
                className="text-body hover:bg-surface-hover block w-full px-3 py-1.5 text-left text-sm"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
