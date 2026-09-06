'use client';

import { FogMaterialEditor } from './FogMaterialEditor';
import { FogPresetManager } from './FogPresetManager';
import { FogPresetSelector } from './FogPresetSelector';
import type { FogPresetControls } from '../useFogPresetControls';

export function FogPresetPanel({ controls }: { controls: FogPresetControls }) {
  return (
    <>
      <FogPresetSelector controls={controls} />
      <FogMaterialEditor controls={controls} />
      <FogPresetManager controls={controls} />
    </>
  );
}
