'use client';

import { useRef, useState } from 'react';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';

import type { EncounterEntity, TokenCellSize } from '@/types/encounter';

const SIZES: { cells: TokenCellSize; label: string }[] = [
  { cells: 1, label: 'M 1×1' },
  { cells: 2, label: 'L 2×2' },
  { cells: 3, label: 'H 3×3' },
  { cells: 4, label: 'G 4×4' },
];

export interface TokenSettingsProps {
  entity: EncounterEntity;
  onChange: (updates: Pick<EncounterEntity, 'avatarUrl' | 'tokenSize'>) => void;
}

/** Studio-panel section: entity portrait (URL or upload) + token footprint. */
export function TokenSettings({ entity, onChange }: TokenSettingsProps) {
  const [url, setUrl] = useState(entity.avatarUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cells = entity.tokenSize ?? 1;

  const applyUrl = () => {
    const trimmed = url.trim();
    onChange({ avatarUrl: trimmed === '' ? undefined : trimmed });
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      formData.append('assetId', `entity-portrait-${entity.id}`);
      const res = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) return;
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        setUrl(data.url);
        onChange({ avatarUrl: data.url });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border-divider border-t px-3 py-2">
      <p className="text-muted mb-1.5 text-[11px] font-bold tracking-wider uppercase">
        Token
      </p>
      <div className="mb-2 flex items-center gap-1.5">
        <Input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onBlur={applyUrl}
          placeholder="Portrait URL (https://…)"
          className="min-h-[44px] flex-1 text-xs"
          aria-label="Portrait URL"
        />
        <Button
          variant="outline"
          className="min-h-[44px] text-xs"
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
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label="Token size"
      >
        {SIZES.map(s => (
          <Button
            key={s.cells}
            variant={cells === s.cells ? 'primary' : 'ghost'}
            className="min-h-[44px] flex-1 text-xs"
            onClick={() => onChange({ tokenSize: s.cells })}
            role="radio"
            aria-checked={cells === s.cells}
          >
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
