'use client';

import { useRef, useState } from 'react';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Section } from '@/components/ui/layout/section';
import { TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { uploadAsset } from '@/utils/uploadAsset';

import { TokenAppearanceRow } from './TokenAppearanceRow';

import type { EncounterEntity, TokenCellSize } from '@/types/encounter';

const SIZES: { cells: TokenCellSize; label: string }[] = [
  { cells: 1, label: 'M 1×1' },
  { cells: 2, label: 'L 2×2' },
  { cells: 3, label: 'H 3×3' },
  { cells: 4, label: 'G 4×4' },
];

export interface TokenSettingsProps {
  entity: EncounterEntity;
  onChange: (
    updates: Pick<
      EncounterEntity,
      'avatarUrl' | 'tokenSize' | 'chessPiece' | 'color'
    >
  ) => void;
}

/** Studio-panel section: entity portrait (URL or upload) + token footprint. */
export function TokenSettings({ entity, onChange }: TokenSettingsProps) {
  const [url, setUrl] = useState(entity.avatarUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cells = entity.tokenSize ?? 1;

  const applyUrl = () => {
    const trimmed = url.trim();
    onChange({ avatarUrl: trimmed === '' ? undefined : trimmed });
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    setUploadError(false);
    try {
      const uploadedUrl = await uploadAsset(
        file,
        `entity-portrait-${entity.id}`
      );
      setUrl(uploadedUrl);
      onChange({ avatarUrl: uploadedUrl });
    } catch {
      setUploadError(true);
    } finally {
      setUploading(false);
    }
  };

  // Also mounted in the creature drawer tabs, which have no tooltip provider.
  return (
    <TooltipProvider>
      <Section level={4} heading="Token" className="px-3 py-3">
        <div className="mt-2 flex items-center gap-1.5">
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onBlur={applyUrl}
            placeholder="Portrait URL (https://…)"
            size="sm"
            className="flex-1"
            aria-label="Portrait URL"
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />
        </div>
        {uploadError && (
          <p role="alert" className="type-small text-blood-text mt-1">
            Couldn&apos;t upload the image. Paste an image URL instead.
          </p>
        )}
        <TokenAppearanceRow entity={entity} onChange={onChange} />
        <div
          className="flex items-center gap-1"
          role="radiogroup"
          aria-label="Token size"
        >
          {SIZES.map(s => (
            <Button
              key={s.cells}
              variant="secondary"
              size="sm"
              selected={cells === s.cells}
              className="flex-1"
              onClick={() => onChange({ tokenSize: s.cells })}
              role="radio"
              aria-checked={cells === s.cells}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </Section>
    </TooltipProvider>
  );
}
