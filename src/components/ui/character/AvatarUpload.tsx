/**
 * Avatar Upload Component
 *
 * Allows users to upload and display character avatars.
 * Images are converted to base64 and stored in character data.
 */

'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import * as Popover from '@radix-ui/react-popover';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { Upload, X, User } from 'lucide-react';
import { Button } from '@/components/ui/forms';
import { ImageLightbox } from '@/components/ui/feedback/ImageLightbox';
import { cn } from '@/utils/cn';
import { MAX_AVATAR_SIZE_BYTES } from '@/utils/constants';

export interface AvatarUploadProps {
  avatar?: string; // S3 URL or base64 encoded image (for backwards compatibility)
  characterId: string; // Required for S3 uploads
  characterName: string;
  onAvatarChange: (avatar: string | undefined) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  editable?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-16 w-16',
  md: 'h-24 w-24',
  lg: 'h-32 w-32',
  xl: 'h-48 w-48',
};

const iconSizeClasses = {
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
};

export function AvatarUpload({
  avatar,
  characterId,
  characterName,
  onAvatarChange,
  size = 'md',
  editable = true,
  className,
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError("That file isn't an image. Choose a PNG, JPG or WebP.");
      return;
    }

    // Validate file size
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setError('Up to 5 MB.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('characterId', characterId);

      // Upload to S3 via API route
      const response = await fetch('/api/avatar/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const { url } = await response.json();

      // Delete old avatar from S3 if it exists and is an S3 URL
      if (avatar && avatar.includes('s3.amazonaws.com')) {
        await fetch(`/api/avatar/delete?url=${encodeURIComponent(avatar)}`, {
          method: 'DELETE',
        });
      }

      onAvatarChange(url);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
      setIsLoading(false);
    }

    // Reset input
    event.target.value = '';
  };

  const handleRemoveAvatar = async () => {
    // Delete from S3 if it's an S3 URL
    if (avatar && avatar.includes('s3.amazonaws.com')) {
      try {
        await fetch(`/api/avatar/delete?url=${encodeURIComponent(avatar)}`, {
          method: 'DELETE',
        });
      } catch {
        // Local removal is still available when remote deletion fails.
      }
    }

    onAvatarChange(undefined);
    setError(null);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const portrait = (
    <button
      type="button"
      className={cn(
        'border-divider bg-surface-inset relative overflow-hidden rounded-md border-2',
        sizeClasses[size],
        avatar && 'hover:border-input-border cursor-pointer transition-colors',
        isLoading && 'opacity-50'
      )}
      onClick={event => {
        event.stopPropagation();
        if (editable) setMenuOpen(!menuOpen);
        else if (avatar) setShowFullImage(true);
      }}
      aria-label={
        editable
          ? avatar
            ? `Change ${characterName} avatar`
            : `Upload ${characterName} avatar`
          : avatar
            ? `View ${characterName} image full size`
            : `${characterName} has no avatar`
      }
      disabled={!editable && !avatar}
    >
      {avatar ? (
        <Image
          src={avatar}
          alt={`${characterName} avatar`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <User size={iconSizeClasses[size]} className="text-muted" />
        </div>
      )}

      {isLoading && (
        <div className="bg-surface-overlay absolute inset-0 flex items-center justify-center">
          <div className="border-heading h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
        </div>
      )}
    </button>
  );
  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative">
        <Popover.Root open={editable && menuOpen} onOpenChange={setMenuOpen}>
          {editable ? (
            <Popover.Trigger asChild>{portrait}</Popover.Trigger>
          ) : (
            portrait
          )}
          {editable && (
            <Popover.Portal>
              <Popover.Content
                aria-label={avatar ? 'Change avatar' : 'Upload avatar'}
                sideOffset={8}
                className={`${OVERLAY_SURFACE} z-50 max-w-[calc(100vw-1rem)] p-3`}
              >
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUploadClick}
                    disabled={isLoading}
                    leftIcon={<Upload size={14} aria-hidden />}
                  >
                    {avatar ? 'Change avatar' : 'Upload avatar'}
                  </Button>
                  {avatar && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      aria-label="Remove avatar"
                      disabled={isLoading}
                      onClick={() => {
                        void handleRemoveAvatar();
                        setMenuOpen(false);
                      }}
                    >
                      <X size={16} aria-hidden />
                    </Button>
                  )}
                </div>
                {!error && (
                  <p className="type-small text-muted mt-2">Up to 5 MB.</p>
                )}
                {error && (
                  <p role="alert" className="type-small text-blood-text mt-2">
                    {error}
                  </p>
                )}
              </Popover.Content>
            </Popover.Portal>
          )}
        </Popover.Root>
      </div>
      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      )}

      {showFullImage && avatar && (
        <ImageLightbox
          src={avatar}
          alt={`${characterName} avatar`}
          onClose={() => setShowFullImage(false)}
        />
      )}
    </div>
  );
}
