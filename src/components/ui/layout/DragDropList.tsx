'use client';

import React, { ReactNode, useState, useEffect } from 'react';
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

function useHasHover() {
  const [hasHover, setHasHover] = useState(true);
  useEffect(() => {
    setHasHover(window.matchMedia('(hover: hover)').matches);
  }, []);
  return hasHover;
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
  const hasHover = useHasHover();
  const canDrag = !disabled && hasHover;

  const {
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    getDragOverStyles,
    getDraggedStyles,
  } = useDragAndDrop({ onReorder, disabled: !canDrag });

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
            className={` ${itemClassName} ${dragOverStyles} ${draggedStyles} transition-all duration-200`}
            draggable={canDrag}
            onDragStart={canDrag ? e => handleDragStart(e, index) : undefined}
            onDragEnd={canDrag ? handleDragEnd : undefined}
            onDragOver={canDrag ? e => handleDragOver(e, index) : undefined}
            onDragLeave={canDrag ? handleDragLeave : undefined}
            onDrop={canDrag ? e => handleDrop(e, index) : undefined}
          >
            {showDragHandle && canDrag ? (
              <div className="relative h-full">
                {renderItem(item, index, isDragging)}
                <div
                  className={`absolute z-10 opacity-40 transition-opacity group-hover:opacity-80 hover:!opacity-100 ${
                    dragHandlePosition === 'right'
                      ? 'right-1.5 bottom-1.5'
                      : 'bottom-1.5 left-1.5'
                  }`}
                >
                  <DragHandle isDragEnabled={canDrag} />
                </div>
              </div>
            ) : (
              renderItem(item, index, isDragging)
            )}
          </div>
        );
      })}
    </div>
  );
}
