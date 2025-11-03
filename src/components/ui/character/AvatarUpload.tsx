/**
 * Avatar Upload Component
 * 
 * Allows users to upload and display character avatars.
 * Images are converted to base64 and stored in character data.
 */

'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, User } from 'lucide-react';
import { Button } from '@/components/ui/forms';
import { cn } from '@/utils/cn';

export interface AvatarUploadProps {
  avatar?: string; // Base64 encoded image
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
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 2MB to keep localStorage reasonable)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      setError('Image must be smaller than 2MB');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        onAvatarChange(base64);
        setIsLoading(false);
      };

      reader.onerror = () => {
        setError('Failed to read image file');
        setIsLoading(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to process image');
      setIsLoading(false);
    }

    // Reset input
    event.target.value = '';
  };

  const handleRemoveAvatar = () => {
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
            <img
              src={avatar}
              alt={`${characterName} avatar`}
              className="h-full w-full object-cover"
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
          Max 2MB • JPG, PNG, GIF
        </p>
      )}
    </div>
  );
}

