'use client';

import React from 'react';
import { GripVertical } from 'lucide-react';

interface DragHandleProps {
  isDragEnabled?: boolean;
  className?: string;
}

/**
 * Grip icon for a draggable row. It is a mouse-only affordance (the row is the
 * drag source), so it is hidden from assistive tech and carries no tooltip.
 */
export default function DragHandle({
  isDragEnabled = true,
  className = '',
}: DragHandleProps) {
  if (!isDragEnabled) {
    return null;
  }

  return (
    <div
      aria-hidden
      className={`flex cursor-grab items-center justify-center active:cursor-grabbing ${className}`}
    >
      <GripVertical
        size={16}
        className="text-muted hover:text-heading transition-colors duration-120"
      />
    </div>
  );
}
