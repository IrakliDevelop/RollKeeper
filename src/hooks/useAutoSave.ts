import { useEffect, useRef, useCallback } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { AUTOSAVE_DELAY } from '@/utils/constants';
import { isBrowserCharacterCutoverParticipant } from '@/lib/indexeddb/characterCutoverSelection';
import { awaitCharacterPersistenceResult } from '@/lib/indexeddb/characterPersistenceRuntime';
import { recordAutomaticCharacterEdit } from '@/lib/supabase/automaticCharacterSyncRuntime';
import { usePlayerStore } from '@/store/playerStore';

interface UseAutoSaveOptions {
  delay?: number;
  enabled?: boolean;
  onAfterSave?: () => void;
}

export const useAutoSave = (options: UseAutoSaveOptions = {}) => {
  const { delay = AUTOSAVE_DELAY, enabled = true, onAfterSave } = options;

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localPersistenceFailureRef = useRef(false);
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

  const finalizeIndexedDbSave = useCallback(
    async (
      result: Awaited<ReturnType<typeof awaitCharacterPersistenceResult>>
    ) => {
      if (!result.saved) {
        localPersistenceFailureRef.current = true;
        useCharacterStore.setState({ hasUnsavedChanges: true });
        setSaveStatus('error');
        return;
      }
      const activeCharacter = usePlayerStore.getState().getActiveCharacter();
      if (activeCharacter) await recordAutomaticCharacterEdit(activeCharacter);
      localPersistenceFailureRef.current = false;
      markSaved();
      setSaveStatus(
        result.mirrorPending ? 'saved-local-mirror-pending' : 'saved-local'
      );
      onAfterSaveRef.current?.();
    },
    [markSaved, setSaveStatus]
  );

  const debouncedSave = useCallback(() => {
    if (localPersistenceFailureRef.current) return;
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
        if (isBrowserCharacterCutoverParticipant()) {
          void awaitCharacterPersistenceResult()
            .then(finalizeIndexedDbSave)
            .catch(() => {
              localPersistenceFailureRef.current = true;
              useCharacterStore.setState({ hasUnsavedChanges: true });
              setSaveStatus('error');
            });
          return;
        }
        setSaveStatus('saved');
        markSaved();
        onAfterSaveRef.current?.();
      } catch (error) {
        console.error('Auto-save failed:', error);
        localPersistenceFailureRef.current = true;
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
    finalizeIndexedDbSave,
  ]);

  const manualSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (!hasUnsavedChanges) {
      return;
    }

    localPersistenceFailureRef.current = false;
    setSaveStatus('saving');

    try {
      saveCharacter();
      if (isBrowserCharacterCutoverParticipant()) {
        void awaitCharacterPersistenceResult()
          .then(finalizeIndexedDbSave)
          .catch(() => {
            localPersistenceFailureRef.current = true;
            useCharacterStore.setState({ hasUnsavedChanges: true });
            setSaveStatus('error');
          });
        return;
      }
      setSaveStatus('saved');
      markSaved();
      onAfterSaveRef.current?.();
    } catch (error) {
      console.error('Manual save failed:', error);
      localPersistenceFailureRef.current = true;
      setSaveStatus('error');
    }
  }, [
    hasUnsavedChanges,
    saveCharacter,
    setSaveStatus,
    markSaved,
    finalizeIndexedDbSave,
  ]);

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
        if (localPersistenceFailureRef.current) return;
        // Cancel pending auto-save and save immediately
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        try {
          saveCharacter();
          if (isBrowserCharacterCutoverParticipant()) {
            void awaitCharacterPersistenceResult()
              .then(finalizeIndexedDbSave)
              .catch(() => {
                localPersistenceFailureRef.current = true;
                useCharacterStore.setState({ hasUnsavedChanges: true });
                useCharacterStore.getState().setSaveStatus('error');
              });
          } else {
            markSaved();
          }
        } catch (error) {
          console.error('Failed to save on visibility change:', error);
          localPersistenceFailureRef.current = true;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasUnsavedChanges, saveCharacter, markSaved, finalizeIndexedDbSave]);

  return {
    saveStatus,
    hasUnsavedChanges,
    manualSave,
    isAutoSaveEnabled: enabled,
  };
};
