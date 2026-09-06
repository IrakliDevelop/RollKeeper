'use client';

import type { FogPresetControls } from '../useFogPresetControls';
import { FogMaterialEditor } from './FogMaterialEditor';
import { FogPresetManager } from './FogPresetManager';
import { FogPresetSelector } from './FogPresetSelector';

export function FogPresetPanel({ controls }: { controls: FogPresetControls }) {
  if (!controls.enabled) return null;
  return (
    <>
      <FogPresetSelector controls={controls} />
      <FogMaterialEditor controls={controls} />
      <FogPresetManager controls={controls} />
    </>
  );
}
