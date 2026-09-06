'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Switch } from '@/components/ui/forms/switch';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { FogProceduralFields, HexField } from './FogMaterialFields';
import type { FogPresetControls } from '../useFogPresetControls';

export function FogMaterialEditor({
  controls,
}: {
  controls: FogPresetControls;
}) {
  const { editor } = controls;
  const [name, setName] = useState('');
  if (!editor) return null;
  const { draft, sourcePresetId, error } = editor;

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) controls.cancelEditor();
      }}
    >
      <DialogContent aria-label="Fog material">
        <DialogHeader>
          <DialogTitle>Fog material</DialogTitle>
          <DialogDescription>
            Changes preview on this map only until you apply them.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <Switch
            label="Noise texture"
            checked={draft.kind === 'procedural'}
            onCheckedChange={checked =>
              controls.setDraftKind(checked ? 'procedural' : 'solid')
            }
            wrapperClassName="min-h-[44px] items-center"
          />
          {draft.kind === 'solid' ? (
            <HexField
              key="solid"
              label="Fog color"
              value={draft.color}
              onCommit={color => controls.updateDraft({ color })}
            />
          ) : (
            <FogProceduralFields controls={controls} draft={draft} />
          )}
          <Input
            label="Preset name"
            aria-label="Preset name"
            value={name}
            onChange={event => setName(event.target.value)}
            error={error ?? undefined}
            className="min-h-[44px]"
          />
        </DialogBody>
        <DialogFooter className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={controls.resetDraft}
            className="min-h-[44px] px-3 text-xs"
          >
            Reset
          </Button>
          <Button
            variant="ghost"
            onClick={controls.cancelEditor}
            className="min-h-[44px] px-3 text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (controls.saveDraftAsPreset(name) === null) setName('');
            }}
            className="min-h-[44px] px-3 text-xs"
          >
            Save as new preset
          </Button>
          {sourcePresetId && (
            <Button
              variant="secondary"
              onClick={() => controls.updateSourcePreset()}
              className="min-h-[44px] px-3 text-xs"
            >
              Update preset
            </Button>
          )}
          <Button
            variant="primary"
            onClick={controls.applyDraft}
            className="min-h-[44px] px-3 text-xs"
          >
            Apply to map
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
