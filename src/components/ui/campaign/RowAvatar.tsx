'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageLightbox } from '@/components/ui/feedback/ImageLightbox';

export function RowAvatar({ src, name }: { src?: string; name: string }) {
  const [open, setOpen] = useState(false);
  if (!src) {
    return (
      <span
        aria-hidden="true"
        className="hidden size-10 shrink-0 sm:block pointer-coarse:size-11"
      />
    );
  }
  return (
    <>
      <button
        type="button"
        aria-label={`View ${name} image full size`}
        onClick={() => setOpen(true)}
        className="border-divider relative size-10 shrink-0 overflow-hidden rounded-md border pointer-coarse:size-11"
      >
        <Image
          src={src}
          alt=""
          fill
          sizes="44px"
          className="object-cover"
          unoptimized={src.startsWith('data:')}
        />
      </button>
      {open && (
        <ImageLightbox src={src} alt={name} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
