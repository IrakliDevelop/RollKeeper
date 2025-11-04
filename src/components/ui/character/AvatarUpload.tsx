/**
 * Avatar Upload Component
 * 
 * Allows users to upload and display character avatars.
 * Images are converted to base64 and stored in character data.
 */

'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { Upload, X, User } from 'lucide-react';
import { Button } from '@/components/ui/forms';
import { cn } from '@/utils/cn';

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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('🔍 File selected:', file);
    
    if (!file) {
      console.log('❌ No file selected');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.log('❌ Invalid file type:', file.type);
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      console.log('❌ File too large:', file.size, 'bytes');
      setError('Image must be smaller than 5MB');
      return;
    }

    console.log('✅ File validation passed, uploading to S3...');
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
      console.log('✅ Upload successful! URL:', url);
      
      // Delete old avatar from S3 if it exists and is an S3 URL
      if (avatar && avatar.includes('s3.amazonaws.com')) {
        console.log('🗑️ Deleting old avatar from S3...');
        await fetch(`/api/avatar/delete?url=${encodeURIComponent(avatar)}`, {
          method: 'DELETE',
        });
      }

      onAvatarChange(url);
      setIsLoading(false);
    } catch (err) {
      console.log('❌ Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
      setIsLoading(false);
    }

    // Reset input
    event.target.value = '';
  };

  const handleRemoveAvatar = async () => {
    // Delete from S3 if it's an S3 URL
    if (avatar && avatar.includes('s3.amazonaws.com')) {
      console.log('🗑️ Deleting avatar from S3...');
      try {
        await fetch(`/api/avatar/delete?url=${encodeURIComponent(avatar)}`, {
          method: 'DELETE',
        });
        console.log('✅ Avatar deleted from S3');
      } catch (err) {
        console.log('⚠️ Failed to delete from S3:', err);
      }
    }
    
    onAvatarChange(undefined);
    setError(null);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative">
        {/* Avatar Display */}
        <div
          className={cn(
            'relative overflow-hidden rounded-full border-2 border-gray-300 bg-gradient-to-br from-slate-100 to-slate-200',
            sizeClasses[size],
            editable && 'cursor-pointer hover:border-blue-400 transition-colors',
            isLoading && 'opacity-50'
          )}
          onClick={editable ? handleUploadClick : undefined}
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
              <User 
                size={iconSizeClasses[size]} 
                className="text-slate-400"
              />
            </div>
          )}
          
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
            </div>
          )}
        </div>

        {/* Remove Button (only show if avatar exists and is editable) */}
        {avatar && editable && !isLoading && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveAvatar();
            }}
            className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white shadow-lg hover:bg-red-600 transition-colors"
            title="Remove avatar"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Upload Button (only show if editable) */}
      {editable && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleUploadClick}
            disabled={isLoading}
            leftIcon={<Upload size={14} />}
          >
            {avatar ? 'Change Avatar' : 'Upload Avatar'}
          </Button>
        </>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-xs text-red-600">
          {error}
        </p>
      )}

      {/* Helper Text */}
      {editable && !error && (
        <p className="text-xs text-gray-500 text-center">
          Max 5MB • Uploaded to cloud storage
        </p>
      )}
    </div>
  );
}

