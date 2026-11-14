'use client';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogTitle,
} from '@/components/ui/feedback/dialog';

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  return (
    <Dialog
      open
      onOpenChange={next => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="w-max max-w-[95vw] pt-16"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{`${alt} full-size image`}</DialogTitle>
        <DialogBody className="flex items-center justify-center overflow-hidden">
          <img
            src={src}
            alt={alt}
            className="max-h-[80vh] max-w-full rounded-md object-contain"
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
