import { useEffect, useRef, useCallback } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { AUTOSAVE_DELAY } from '@/utils/constants';

interface UseAutoSaveOptions {
  delay?: number;
  enabled?: boolean;
  onAfterSave?: () => void;
}

export const useAutoSave = (options: UseAutoSaveOptions = {}) => {
  const { delay = AUTOSAVE_DELAY, enabled = true, onAfterSave } = options;

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);
  const onAfterSaveRef = useRef(onAfterSave);
  onAfterSaveRef.current = onAfterSave;

  const {
    hasUnsavedChanges,
    saveStatus,
    saveCharacter,
    setSaveStatus,
    markSaved,
  } = useCharacterStore();

  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (!enabled || !hasUnsavedChanges) {
      return;
    }

    setSaveStatus('saving');

    saveTimeoutRef.current = setTimeout(() => {
      try {
        saveCharacter();
        setSaveStatus('saved');
        markSaved();
        onAfterSaveRef.current?.();
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveStatus('error');
      }
    }, delay);
  }, [
    enabled,
    hasUnsavedChanges,
    delay,
    saveCharacter,
    setSaveStatus,
    markSaved,
  ]);

  const manualSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (!hasUnsavedChanges) {
      return;
    }

    setSaveStatus('saving');

    try {
      saveCharacter();
      setSaveStatus('saved');
      markSaved();
      onAfterSaveRef.current?.();
    } catch (error) {
      console.error('Manual save failed:', error);
      setSaveStatus('error');
    }
  }, [hasUnsavedChanges, saveCharacter, setSaveStatus, markSaved]);

  // Effect to trigger auto-save when data changes
  useEffect(() => {
    // Skip auto-save on initial mount to avoid saving default state
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (hasUnsavedChanges && enabled) {
      debouncedSave();
    }

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [hasUnsavedChanges, debouncedSave, enabled]);

  // Keyboard shortcuts effect
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+S (or Cmd+S on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        manualSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [manualSave]);

  // Save on page beforeunload (browser close/refresh)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        // Cancel any pending auto-save
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        // Attempt immediate save
        try {
          saveCharacter();
        } catch (error) {
          console.error('Failed to save on page unload:', error);
        }

        // Show browser warning if there are unsaved changes
        event.preventDefault();
        event.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, saveCharacter]);

  // Save on visibility change (tab switch, minimize)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasUnsavedChanges) {
        // Cancel pending auto-save and save immediately
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        try {
          saveCharacter();
          markSaved();
        } catch (error) {
          console.error('Failed to save on visibility change:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasUnsavedChanges, saveCharacter, markSaved]);

  return {
    saveStatus,
    hasUnsavedChanges,
    manualSave,
    isAutoSaveEnabled: enabled,
  };
};
