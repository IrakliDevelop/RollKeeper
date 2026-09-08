import type { FogManager, FogViewMode } from '@fieldnotes/vtt';

export function configureFogView(
  fogManager: FogManager,
  role: 'dm' | 'player' | 'display',
  preview: boolean
): void {
  const mode: FogViewMode =
    role !== 'dm' ? 'player' : preview ? 'player' : 'editor';
  fogManager.setViewMode(mode);
}
