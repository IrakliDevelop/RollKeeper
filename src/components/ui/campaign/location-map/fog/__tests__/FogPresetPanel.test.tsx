import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FogPresetPanel } from '../FogPresetPanel';
import type { FogPresetControls } from '../useFogPresetControls';

// This suite's vitest project runs without `test.globals`, so
// @testing-library/react cannot auto-detect a global `afterEach` to register
// its automatic unmount. Without this, each `render()` in this file would
// leave its previous tree mounted, and role queries below (e.g. "Fog
// appearance") would match multiple elements across tests.
afterEach(cleanup);

const preset = {
  v: 1 as const,
  id: 'fp_red',
  name: 'Red Mist',
  material: { v: 1 as const, kind: 'solid' as const, color: '#ff0000' },
  createdAt: '2026-09-05T00:00:00.000Z',
  updatedAt: '2026-09-05T00:00:00.000Z',
};

function controls(
  overrides: Partial<FogPresetControls> = {}
): FogPresetControls {
  return {
    enabled: true,
    library: [preset],
    applied: 'solid',
    selectedValue: 'solid',
    appliedLabel: null,
    select: vi.fn(),
    editor: null,
    openEditor: vi.fn(),
    updateDraft: vi.fn(),
    setDraftKind: vi.fn(),
    randomizeSeed: vi.fn(),
    resetDraft: vi.fn(),
    cancelEditor: vi.fn(),
    applyDraft: vi.fn(),
    saveDraftAsPreset: vi.fn(() => null),
    updateSourcePreset: vi.fn(() => null),
    managerOpen: false,
    openManager: vi.fn(),
    closeManager: vi.fn(),
    renamePreset: vi.fn(() => null),
    duplicatePreset: vi.fn(() => null),
    pendingDeleteId: null,
    requestDelete: vi.fn(),
    confirmDelete: vi.fn(),
    cancelDelete: vi.fn(),
    ...overrides,
  };
}

describe('FogPresetPanel selector', () => {
  it('lists built-ins first, then presets, and applies on change', () => {
    const c = controls();
    render(<FogPresetPanel controls={c} />);
    const select = screen.getByRole('combobox', { name: 'Fog appearance' });
    const labels = within(select)
      .getAllByRole('option')
      .map(o => o.textContent);
    expect(labels).toEqual(['Solid (classic)', 'Cloudy', 'Red Mist']);
    fireEvent.change(select, { target: { value: 'fp_red' } });
    expect(c.select).toHaveBeenCalledWith('fp_red');
  });

  it('shows a Custom option with the applied label when the map has a modified snapshot', () => {
    render(
      <FogPresetPanel
        controls={controls({
          selectedValue: 'custom',
          appliedLabel: 'Modified',
        })}
      />
    );
    const select = screen.getByRole('combobox', { name: 'Fog appearance' });
    expect(select).toHaveValue('custom');
    expect(
      within(select).getByRole('option', { name: 'Modified' })
    ).toBeInTheDocument();
  });

  it('opens the editor and the manager', () => {
    const c = controls();
    render(<FogPresetPanel controls={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Customize fog' }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage fog presets' }));
    expect(c.openEditor).toHaveBeenCalled();
    expect(c.openManager).toHaveBeenCalled();
  });
});

describe('FogMaterialEditor', () => {
  const procedural = {
    v: 1 as const,
    kind: 'procedural' as const,
    baseColor: '#102030',
    noiseColor: '#a0b0c0',
    noiseOpacity: 0.4,
    scale: 300,
    detail: 3 as const,
    seed: 7,
  };

  it('renders procedural controls and routes edits through updateDraft', () => {
    const c = controls({
      editor: { draft: procedural, sourcePresetId: null, error: null },
    });
    render(<FogPresetPanel controls={c} />);
    const dialog = screen.getByRole('dialog', { name: 'Fog material' });
    expect(
      within(dialog).getByRole('switch', { name: 'Noise texture' })
    ).toHaveAttribute('aria-checked', 'true');
    fireEvent.change(
      within(dialog).getByRole('slider', { name: 'Noise amount' }),
      { target: { value: '0.9' } }
    );
    expect(c.updateDraft).toHaveBeenCalledWith({ noiseOpacity: 0.9 });
    fireEvent.change(
      within(dialog).getByRole('slider', { name: 'Noise size' }),
      { target: { value: '512' } }
    );
    expect(c.updateDraft).toHaveBeenCalledWith({ scale: 512 });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Randomize seed' })
    );
    expect(c.randomizeSeed).toHaveBeenCalled();
    expect(
      within(dialog).queryByRole('button', { name: 'Update preset' })
    ).toBeNull();
  });

  it('only accepts full hex colors from the text field', () => {
    const c = controls({
      editor: { draft: procedural, sourcePresetId: null, error: null },
    });
    render(<FogPresetPanel controls={c} />);
    const field = screen.getByRole('textbox', { name: 'Fog color' });
    fireEvent.change(field, { target: { value: '#12' } });
    expect(c.updateDraft).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: '#ABCDEF' } });
    expect(c.updateDraft).toHaveBeenCalledWith({ baseColor: '#abcdef' });
  });

  it('saves with a name, surfaces errors, and offers Update for a sourced draft', () => {
    const c = controls({
      editor: {
        draft: preset.material,
        sourcePresetId: 'fp_red',
        error: 'A preset with that name already exists.',
      },
    });
    render(<FogPresetPanel controls={c} />);
    const dialog = screen.getByRole('dialog', { name: 'Fog material' });
    expect(
      within(dialog).getByText('A preset with that name already exists.')
    ).toBeInTheDocument();
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: 'Preset name' }),
      { target: { value: 'Crimson' } }
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Save as new preset' })
    );
    expect(c.saveDraftAsPreset).toHaveBeenCalledWith('Crimson');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Update preset' })
    );
    expect(c.updateSourcePreset).toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Apply to map' })
    );
    expect(c.applyDraft).toHaveBeenCalled();
  });
});

describe('FogPresetManager', () => {
  it('renames, duplicates, and confirms deletion with copy-on-apply wording', () => {
    const c = controls({ managerOpen: true, pendingDeleteId: 'fp_red' });
    render(<FogPresetPanel controls={c} />);
    const dialog = screen.getByRole('dialog', { name: 'Fog presets' });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Duplicate Red Mist' })
    );
    expect(c.duplicatePreset).toHaveBeenCalledWith('fp_red');
    const confirm = screen.getByRole('alertdialog', {
      name: 'Delete fog preset',
    });
    expect(confirm).toHaveTextContent(
      'Maps already using this preset keep their current appearance.'
    );
    fireEvent.click(
      within(confirm).getByRole('button', { name: 'Delete preset' })
    );
    expect(c.confirmDelete).toHaveBeenCalled();
  });
});
