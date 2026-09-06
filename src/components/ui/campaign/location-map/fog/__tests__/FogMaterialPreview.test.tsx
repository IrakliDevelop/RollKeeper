import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderFogStylePreview } from '@fieldnotes/core';
import { FogMaterialPreview } from '../FogPresetPanel/FogMaterialFields';

vi.mock('@fieldnotes/core', async importOriginal => ({
  ...(await importOriginal<typeof import('@fieldnotes/core')>()),
  renderFogStylePreview: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

describe('FogMaterialPreview', () => {
  const ctx = { scale: vi.fn() } as unknown as CanvasRenderingContext2D;

  beforeEach(() => {
    vi.mocked(renderFogStylePreview).mockClear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'getBoundingClientRect'
    ).mockReturnValue({
      width: 176,
      height: 176,
    } as DOMRect);
  });

  it('renders the current material through the Fieldnotes preview API', () => {
    const { rerender } = render(
      <FogMaterialPreview
        material={{
          v: 1,
          kind: 'procedural',
          baseColor: '#102030',
          noiseColor: '#a0b0c0',
          noiseOpacity: 0.4,
          scale: 300,
          detail: 3,
          seed: 7,
        }}
      />
    );

    expect(
      screen.getByRole('img', { name: 'Fog material preview' })
    ).toBeInTheDocument();
    expect(renderFogStylePreview).toHaveBeenCalledWith(
      ctx,
      {
        kind: 'procedural',
        backdrop: '#102030',
        tint: '#a0b0c0',
        opacity: 0.4,
        scale: 300,
        detail: 3,
        seed: 7,
      },
      176,
      176
    );

    rerender(
      <FogMaterialPreview
        material={{
          v: 1,
          kind: 'procedural',
          baseColor: '#304050',
          noiseColor: '#c0d0e0',
          noiseOpacity: 0.8,
          scale: 512,
          detail: 4,
          seed: 42,
        }}
      />
    );
    expect(renderFogStylePreview).toHaveBeenLastCalledWith(
      ctx,
      {
        kind: 'procedural',
        backdrop: '#304050',
        tint: '#c0d0e0',
        opacity: 0.8,
        scale: 512,
        detail: 4,
        seed: 42,
      },
      176,
      176
    );
  });
});
