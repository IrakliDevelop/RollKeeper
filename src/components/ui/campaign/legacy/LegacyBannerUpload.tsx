'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { Upload, X, ImageIcon, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/forms';
import { cn } from '@/utils/cn';
import { MAX_BANNER_SIZE_MB, MAX_BANNER_SIZE_BYTES } from '@/utils/constants';

export interface LegacyBannerUploadProps {
  bannerUrl?: string;
  campaignCode: string;
  onBannerChange: (url: string | undefined) => void;
  editable?: boolean;
  className?: string;
}

/**
 * The banner from before the Felt and Brass redesign, kept as-is for the
 * classic campaign page layout. Don't restyle it; the standard and banner
 * layouts are the redesigned ones.
 */
export function LegacyBannerUpload({
  bannerUrl,
  campaignCode,
  onBannerChange,
  editable = true,
  className,
}: LegacyBannerUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > MAX_BANNER_SIZE_BYTES) {
      setError(`Image must be smaller than ${MAX_BANNER_SIZE_MB}MB`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('campaignCode', campaignCode);

      const response = await fetch('/api/banner/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const { url } = await response.json();

      // Delete old banner from S3 if it exists
      if (bannerUrl && bannerUrl.includes('s3.amazonaws.com')) {
        await fetch(`/api/banner/delete?url=${encodeURIComponent(bannerUrl)}`, {
          method: 'DELETE',
        });
      }

      onBannerChange(url);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload banner');
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const handleRemoveBanner = async () => {
    if (bannerUrl && bannerUrl.includes('s3.amazonaws.com')) {
      try {
        await fetch(`/api/banner/delete?url=${encodeURIComponent(bannerUrl)}`, {
          method: 'DELETE',
        });
      } catch {
        // Deletion failure shouldn't block removal
      }
    }
    onBannerChange(undefined);
    setError(null);
    setIsEditing(false);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Hero variant — full-width banner for campaign dashboard with edit mode
  return (
    <div className={cn('relative h-full', className)}>
      {bannerUrl ? (
        <div className="relative h-full min-h-40 w-full overflow-hidden rounded-lg sm:min-h-48">
          <Image
            src={bannerUrl}
            alt="Campaign banner"
            fill
            className="object-cover"
            sizes="100vw"
          />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
            </div>
          )}
          {editable && !isLoading && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-surface/60 text-body hover:bg-surface/80 absolute top-3 right-3 rounded-full p-2 shadow-md backdrop-blur-sm transition-colors"
              title="Edit banner"
            >
              <Pencil size={14} />
            </button>
          )}
          {editable && !isLoading && isEditing && (
            // The scrim is dark in both themes, so its buttons use the felt
            // palette to stay readable on paper.
            <div
              data-theme="dark"
              className="absolute inset-0 flex items-center justify-center gap-3 bg-black/40"
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={handleUploadClick}
                leftIcon={<Upload size={14} />}
              >
                Change
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRemoveBanner}
                leftIcon={<X size={14} />}
              >
                Remove
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
                className="text-white hover:bg-white/20"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      ) : editable ? (
        <button
          onClick={handleUploadClick}
          className="bg-surface-secondary hover:bg-surface-elevated border-divider flex h-full min-h-28 w-full items-center justify-center gap-3 rounded-lg border-2 border-dashed transition-colors"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <>
              <ImageIcon size={20} className="text-muted" />
              <span className="text-muted text-sm">
                Add a campaign banner image
              </span>
            </>
          )}
        </button>
      ) : null}
      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      )}
      {error && <p className="text-accent-red-text mt-1 text-xs">{error}</p>}
    </div>
  );
}
