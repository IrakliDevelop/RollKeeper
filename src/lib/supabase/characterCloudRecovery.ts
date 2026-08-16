import type { CharacterRecoveryDownload } from './manualCharacterCloudService';

export function downloadCharacterCloudRecovery(
  recovery: CharacterRecoveryDownload
): void {
  const blob = new Blob([JSON.stringify(recovery, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rollkeeper-character-recovery_${recovery.cloud.legacyId}_${recovery.cloud.serverVersion}.json`;
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
