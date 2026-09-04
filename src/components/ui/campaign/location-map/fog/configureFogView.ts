import type { FogViewMode } from '@fieldnotes/core';

export function configureFogView(
  role: 'dm' | 'player' | 'display',
  preview: boolean
): FogViewMode {
  if (role !== 'dm') return 'player';
  return preview ? 'player' : 'editor';
}
