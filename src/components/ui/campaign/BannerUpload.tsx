'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { Upload, X, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/forms';
import { cn } from '@/utils/cn';
import { MAX_BANNER_SIZE_MB, MAX_BANNER_SIZE_BYTES } from '@/utils/constants';

export interface BannerUploadProps {
  bannerUrl?: string;
  campaignCode: string;
  onBannerChange: (url: string | undefined) => void;
  editable?: boolean;
  variant?: 'card' | 'hero';
  className?: string;
}

export function BannerUpload({
  bannerUrl,
  campaignCode,
  onBannerChange,
  editable = true,
  variant = 'hero',
  className,
}: BannerUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  if (variant === 'card') {
    return (
      <div className={cn('relative', className)}>
        {bannerUrl ? (
          <div className="relative h-28 w-full overflow-hidden rounded-t-lg">
            <Image
              src={bannerUrl}
              alt="Campaign banner"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="h-6 w-6 animate-spin rounded-full border-3 border-white border-t-transparent" />
              </div>
            )}
            {editable && !isLoading && (
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  onClick={handleUploadClick}
                  className="bg-surface/80 text-body hover:bg-surface rounded-full p-1.5 shadow-md backdrop-blur-sm transition-colors"
                  title="Change banner"
                >
                  <Upload size={12} />
                </button>
                <button
                  onClick={handleRemoveBanner}
                  className="rounded-full bg-red-500/80 p-1.5 text-white shadow-md backdrop-blur-sm transition-colors hover:bg-red-600"
                  title="Remove banner"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        ) : editable ? (
          <button
            onClick={handleUploadClick}
            className="bg-surface-secondary hover:bg-surface-elevated border-divider flex h-20 w-full items-center justify-center gap-2 rounded-t-lg border-b transition-colors"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <>
                <ImageIcon size={16} className="text-muted" />
                <span className="text-muted text-xs">Add banner</span>
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
        {error && (
          <p className="text-accent-red-text px-3 pt-1 text-xs">{error}</p>
        )}
      </div>
    );
  }

  // Hero variant — full-width banner for campaign dashboard
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
          {editable && !isLoading && (
            <div className="absolute top-3 right-3 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleUploadClick}
                leftIcon={<Upload size={14} />}
                className="bg-surface/80 backdrop-blur-sm"
              >
                Change
              </Button>
              <button
                onClick={handleRemoveBanner}
                className="rounded-full bg-red-500/80 p-2 text-white shadow-md backdrop-blur-sm transition-colors hover:bg-red-600"
                title="Remove banner"
              >
                <X size={14} />
              </button>
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
