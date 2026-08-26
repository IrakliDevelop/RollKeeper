import { useEffect } from 'react';
import { STORAGE_QUOTA_EVENT } from '@/lib/safeStorage';

/**
 * Calls `onQuota` whenever a localStorage write fails due to a full quota
 * (fired by the safe-storage wrapper). Pages use this to warn the user that a
 * save did not persist and they should export a backup.
 */
export function useStorageQuotaListener(onQuota: () => void): void {
  useEffect(() => {
    const handler = () => onQuota();
    window.addEventListener(STORAGE_QUOTA_EVENT, handler);
    return () => window.removeEventListener(STORAGE_QUOTA_EVENT, handler);
  }, [onQuota]);
}
