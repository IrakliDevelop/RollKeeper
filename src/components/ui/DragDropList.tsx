'use client';

import React, { ReactNode } from 'react';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';
import DragHandle from './DragHandle';

interface DragDropListProps<T> {
  items: T[];
  onReorder: (sourceIndex: number, destinationIndex: number) => void;
  renderItem: (item: T, index: number, isDragging: boolean) => ReactNode;
  disabled?: boolean;
  className?: string;
  itemClassName?: string;
  showDragHandle?: boolean;
  dragHandlePosition?: 'left' | 'right';
  keyExtractor: (item: T, index: number) => string | number;
}

/**
 * Generic drag and drop list wrapper component
 */
export default function DragDropList<T>({
  items,
  onReorder,
  renderItem,
  disabled = false,
  className = '',
  itemClassName = '',
  showDragHandle = true,
  dragHandlePosition = 'left',
  keyExtractor,
}: DragDropListProps<T>) {
  const {
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    getDragOverStyles,
    getDraggedStyles,
  } = useDragAndDrop({ onReorder, disabled });

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {items.map((item, index) => {
        const key = keyExtractor(item, index);
        const dragOverStyles = getDragOverStyles(index);
        const draggedStyles = getDraggedStyles(index);
        const isDragging = draggedStyles.includes('opacity-50');

        return (
          <div
            key={key}
            className={`
              ${itemClassName}
              ${dragOverStyles}
              ${draggedStyles}
              transition-all duration-200
            `}
            draggable={!disabled}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
          >
            {showDragHandle && dragHandlePosition === 'left' && (
              <div className="flex items-center">
                <DragHandle isDragEnabled={!disabled} className="mr-2" />
                <div className="flex-1">
                  {renderItem(item, index, isDragging)}
                </div>
              </div>
            )}
            
            {showDragHandle && dragHandlePosition === 'right' && (
              <div className="flex items-center">
                <div className="flex-1">
                  {renderItem(item, index, isDragging)}
                </div>
                <DragHandle isDragEnabled={!disabled} className="ml-2" />
              </div>
            )}
            
            {!showDragHandle && renderItem(item, index, isDragging)}
          </div>
        );
      })}
    </div>
  );
} 