'use client';

import { useRef, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import type { TableRepository } from '@/lib/table/repository';
import { isSceneName, runSceneCommand } from '@/lib/table/sceneCommands';
import {
  prepareSceneImage,
  type SceneImageDecoder,
  type SceneImageUploader,
} from '@/lib/table/sceneImage';

type Kind = 'blank' | 'image';

/**
 * W6: create a scene from a name and either nothing (blank) or an uploaded
 * image. Validation and upload happen before any write; a failure shows its
 * reason and creates no scene. Registration happens later, on selection,
 * through the workspace's one control session.
 */
export function TableCreateSceneDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repository: TableRepository;
  onCreated: (sceneId: string) => void;
  upload?: SceneImageUploader;
  decode?: SceneImageDecoder;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('blank');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName('');
    setKind('blank');
    setFile(null);
    setError(null);
  };

  async function create() {
    const trimmed = name.trim();
    if (!isSceneName(trimmed)) {
      setError('Name the scene (1 to 200 characters).');
      return;
    }
    if (kind === 'image' && !file) {
      setError('Choose a map image or create a blank scene.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sceneId = crypto.randomUUID();
      let mapImageUrl = '';
      let mapImageSize = { w: 0, h: 0 };
      if (kind === 'image' && file) {
        const prepared = await prepareSceneImage(file, {
          assetId: `scene-${sceneId}`,
          decode: props.decode,
          upload: props.upload,
        });
        if (!prepared.ok) {
          setError(prepared.message);
          return;
        }
        mapImageUrl = prepared.url;
        mapImageSize = prepared.size;
      }
      const current = props.repository.getCurrent();
      const result = await runSceneCommand(props.repository, {
        expectedRevision:
          current?.status === 'ready'
            ? (current.snapshot.campaign?.revision ?? 0)
            : 0,
        operationId: `scene-create:${sceneId}`,
        command: {
          type: 'scene.create',
          sceneId,
          name: trimmed,
          mapImageUrl,
          mapImageSize,
          at: new Date().toISOString(),
        },
      });
      if (result.status !== 'committed') {
        setError(
          result.status === 'rejected' && result.reason === 'limit-exceeded'
            ? 'This table is at its scene limit. Nothing was created.'
            : 'The scene could not be saved on this device. Nothing was created.'
        );
        return;
      }
      reset();
      props.onCreated(sceneId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={open => {
        if (!open) reset();
        props.onOpenChange(open);
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>New scene</DialogTitle>
          <DialogDescription>
            Saved on this device. Creating a scene never shows it to players.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={event => {
            event.preventDefault();
            void create();
          }}
        >
          <Input
            id="table-new-scene-name"
            label="Scene name"
            value={name}
            maxLength={400}
            onChange={event => setName(event.target.value)}
            autoFocus
          />
          <div
            role="group"
            aria-label="Scene map"
            className="flex flex-wrap gap-2"
          >
            <Button
              type="button"
              size="sm"
              variant={kind === 'blank' ? 'primary' : 'outline'}
              aria-pressed={kind === 'blank'}
              onClick={() => setKind('blank')}
            >
              Blank
            </Button>
            <Button
              type="button"
              size="sm"
              variant={kind === 'image' ? 'primary' : 'outline'}
              aria-pressed={kind === 'image'}
              onClick={() => setKind('image')}
            >
              Image
            </Button>
          </div>
          {kind === 'image' && (
            <div className="space-y-1">
              <input
                ref={fileRef}
                id="table-new-scene-file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                aria-label="Map image file"
                className="sr-only"
                onChange={event => setFile(event.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                {file ? `Image: ${file.name}` : 'Choose image'}
              </Button>
              <p className="text-muted text-xs">
                PNG, JPEG, WebP or GIF, up to 16384 pixels per side.
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="text-accent-red-text text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => props.onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Create scene
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
