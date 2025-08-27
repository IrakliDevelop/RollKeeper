import { useState, useCallback } from 'react';

export interface DragDropState {
  draggedIndex: number | null;
  dragOverIndex: number | null;
}

export interface DragDropHandlers {
  handleDragStart: (e: React.DragEvent, index: number) => void;
  handleDragEnd: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent, dropIndex: number) => void;
}

export interface UseDragAndDropOptions {
  onReorder: (sourceIndex: number, destinationIndex: number) => void;
  disabled?: boolean;
}

export interface UseDragAndDropReturn extends DragDropState, DragDropHandlers {
  isDragging: boolean;
  getDragOverStyles: (index: number) => string;
  getDraggedStyles: (index: number) => string;
}

/**
 * Reusable hook for drag and drop functionality on lists
 */
export function useDragAndDrop({
  onReorder,
  disabled = false,
}: UseDragAndDropOptions): UseDragAndDropReturn {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      if (disabled) return;

      setDraggedIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', e.currentTarget.outerHTML);
      (e.currentTarget as HTMLElement).style.opacity = '0.5';
    },
    [disabled]
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;

      (e.currentTarget as HTMLElement).style.opacity = '1';
      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      if (disabled) return;

      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(index);
    },
    [disabled]
  );

  const handleDragLeave = useCallback(() => {
    if (disabled) return;
    setDragOverIndex(null);
  }, [disabled]);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      if (disabled) return;

      e.preventDefault();

      if (draggedIndex !== null && draggedIndex !== dropIndex) {
        onReorder(draggedIndex, dropIndex);
      }

      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [disabled, draggedIndex, onReorder]
  );

  const getDragOverStyles = useCallback(
    (index: number): string => {
      return dragOverIndex === index
        ? 'border-blue-400 border-2 bg-blue-50'
        : '';
    },
    [dragOverIndex]
  );

  const getDraggedStyles = useCallback(
    (index: number): string => {
      return draggedIndex === index ? 'opacity-50' : '';
    },
    [draggedIndex]
  );

  return {
    draggedIndex,
    dragOverIndex,
    isDragging: draggedIndex !== null,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    getDragOverStyles,
    getDraggedStyles,
  };
}
