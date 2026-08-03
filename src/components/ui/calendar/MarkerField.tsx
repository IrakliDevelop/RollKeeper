'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { EmojiPicker } from 'frimousse';
import { Button } from '@/components/ui/forms/button';

export type MarkerMode = 'dot' | 'emoji';

interface MarkerFieldProps {
  mode: MarkerMode;
  color: string;
  emoji: string | null;
  onModeChange: (mode: MarkerMode) => void;
  onColorChange: (color: string) => void;
  onEmojiChange: (emoji: string) => void;
}

export function MarkerField({
  mode,
  color,
  emoji,
  onModeChange,
  onColorChange,
  onEmojiChange,
}: MarkerFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div>
      <span className="text-body mb-1 block text-sm font-medium">Marker</span>
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          <Button
            variant={mode === 'dot' ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={mode === 'dot'}
            onClick={() => onModeChange('dot')}
          >
            Dot
          </Button>
          <Button
            variant={mode === 'emoji' ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={mode === 'emoji'}
            onClick={() => onModeChange('emoji')}
          >
            Emoji
          </Button>
        </div>

        {mode === 'dot' ? (
          <div className="flex items-center gap-2">
            <label htmlFor="event-marker-color" className="text-muted text-xs">
              Marker color
            </label>
            <input
              id="event-marker-color"
              type="color"
              value={color}
              onChange={e => onColorChange(e.target.value)}
              className="border-divider h-7 w-9 cursor-pointer rounded border bg-transparent p-0.5"
            />
          </div>
        ) : (
          <Popover.Root open={pickerOpen} onOpenChange={setPickerOpen}>
            <Popover.Trigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label={
                  emoji
                    ? `Marker emoji: ${emoji}`
                    : 'Marker emoji: none selected'
                }
              >
                {emoji ?? 'Pick emoji'}
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                sideOffset={4}
                className="bg-surface-raised border-divider z-50 rounded-lg border shadow-lg"
              >
                <EmojiPicker.Root
                  columns={9}
                  onEmojiSelect={({ emoji: picked }) => {
                    onEmojiChange(picked);
                    setPickerOpen(false);
                  }}
                  className="flex h-72 w-64 flex-col"
                >
                  <EmojiPicker.Search
                    className="border-divider bg-surface-secondary text-body placeholder:text-muted m-2 rounded border px-2 py-1 text-sm focus:outline-none"
                    placeholder="Search emoji…"
                  />
                  <EmojiPicker.Viewport className="relative flex-1 overflow-y-auto px-2 pb-2">
                    <EmojiPicker.Loading className="text-muted absolute inset-0 flex items-center justify-center text-xs">
                      Loading emoji…
                    </EmojiPicker.Loading>
                    <EmojiPicker.Empty className="text-muted absolute inset-0 flex items-center justify-center text-xs">
                      No emoji found
                    </EmojiPicker.Empty>
                    <EmojiPicker.List className="select-none" />
                  </EmojiPicker.Viewport>
                </EmojiPicker.Root>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>
    </div>
  );
}
