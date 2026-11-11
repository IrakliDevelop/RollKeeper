'use client';

import { useRef, type ChangeEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/forms/button';
import {
  MAX_PORTRAIT_SIZE_MB,
  type usePortraitUpload,
} from './usePortraitUpload';

interface PortraitFieldProps {
  url: string;
  portrait: ReturnType<typeof usePortraitUpload>;
}

const ERROR_TEXT = {
  type: 'Choose an image file.',
  size: `Choose an image under ${MAX_PORTRAIT_SIZE_MB} MB.`,
  upload: "The portrait wasn't uploaded. Try again.",
} as const;

export function PortraitField({ url, portrait }: PortraitFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    await portrait.upload(file);
    input.value = '';
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {url && (
          <Image
            src={url}
            alt=""
            width={64}
            height={64}
            className="size-16 rounded-md object-cover"
          />
        )}
        <Button
          variant="secondary"
          size="sm"
          loading={portrait.uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {url ? 'Change portrait' : 'Add portrait'}
        </Button>
        {url && (
          <Button
            variant="danger"
            size="sm"
            disabled={portrait.uploading}
            onClick={portrait.remove}
          >
            Remove portrait
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleFileSelect}
        />
      </div>
      {portrait.error && (
        <p role="alert" className="type-small text-blood-text mt-2">
          {ERROR_TEXT[portrait.error]}
        </p>
      )}
    </div>
  );
}
