'use client';

import { X } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/80 p-4"
      onClick={event => {
        event.stopPropagation();
        onClose();
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} full-size image`}
    >
      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          onClose();
        }}
        autoFocus
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        aria-label="Close image"
      >
        <X className="h-6 w-6" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        onClick={event => event.stopPropagation()}
      />
      <p className="absolute bottom-4 text-center text-sm text-white/60">
        Right-click image to copy or save
      </p>
    </div>
  );
}
