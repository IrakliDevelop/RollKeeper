'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
import { MAX_BANNER_SIZE_MB, MAX_BANNER_SIZE_BYTES } from '@/utils/constants';

export interface BannerImageControlsProps {
  bannerUrl?: string;
  campaignCode: string;
  onBannerChange: (url: string | undefined) => void;
}

const UPLOAD_FAILED = "The banner wasn't uploaded. Try again.";

function deleteStoredBanner(bannerUrl: string) {
  return fetch(`/api/banner/delete?url=${encodeURIComponent(bannerUrl)}`, {
    method: 'DELETE',
  });
}

export function BannerImageControls({
  bannerUrl,
  campaignCode,
  onBannerChange,
}: BannerImageControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.');
      input.value = '';
      return;
    }
    if (file.size > MAX_BANNER_SIZE_BYTES) {
      setError(`Choose an image under ${MAX_BANNER_SIZE_MB} MB.`);
      input.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('campaignCode', campaignCode);

      const response = await fetch('/api/banner/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('upload failed');

      const body: unknown = await response.json();
      const url =
        body && typeof body === 'object' && 'url' in body ? body.url : null;
      if (typeof url !== 'string' || !url) throw new Error('no url');

      // Delete the old banner from S3 only when it lives there.
      if (bannerUrl && bannerUrl.includes('s3.amazonaws.com')) {
        await deleteStoredBanner(bannerUrl);
      }
      onBannerChange(url);
    } catch {
      setError(UPLOAD_FAILED);
    } finally {
      setIsUploading(false);
      input.value = '';
    }
  };

  const handleRemove = async () => {
    const confirmed = await confirmDialog({
      title: 'Remove the banner image?',
      message: 'The image is removed from this page and the campaign card.',
      confirmLabel: 'Remove image',
      tone: 'danger',
    });
    if (!confirmed) return;
    if (bannerUrl && bannerUrl.includes('s3.amazonaws.com')) {
      try {
        await deleteStoredBanner(bannerUrl);
      } catch {
        // Deletion failure shouldn't block removal
      }
    }
    setError(null);
    onBannerChange(undefined);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 lg:w-full lg:flex-col">
        <Button
          variant="secondary"
          size="sm"
          className="lg:w-full"
          loading={isUploading}
          leftIcon={<Upload size={14} aria-hidden="true" />}
          onClick={() => fileInputRef.current?.click()}
        >
          {bannerUrl ? 'Change image' : 'Add image'}
        </Button>
        {bannerUrl && (
          <Button
            variant="danger"
            size="sm"
            className="lg:w-full"
            disabled={isUploading}
            onClick={handleRemove}
          >
            Remove image
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
      {error && (
        <p role="alert" className="type-small text-blood-text mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
