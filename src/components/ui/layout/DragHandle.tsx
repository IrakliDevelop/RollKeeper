'use client';

import React from 'react';
import { GripVertical } from 'lucide-react';

interface DragHandleProps {
  isDragEnabled?: boolean;
  className?: string;
  size?: number;
  color?: string;
}

/**
 * Reusable drag handle component with consistent styling
 */
export default function DragHandle({
  isDragEnabled = true,
  className = '',
  size = 16,
  color = 'text-gray-400',
}: DragHandleProps) {
  if (!isDragEnabled) {
    return null;
  }

  return (
    <div
      className={`flex cursor-grab items-center justify-center transition-colors duration-200 active:cursor-grabbing ${className}`}
      title="Drag to reorder"
    >
      <GripVertical
        size={size}
        className={`${color} transition-colors duration-200 hover:text-gray-600`}
      />
    </div>
  );
}
