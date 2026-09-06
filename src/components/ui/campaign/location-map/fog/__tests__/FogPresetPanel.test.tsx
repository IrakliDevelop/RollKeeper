import { useState } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FogPresetPanel } from '../FogPresetPanel';
import {
  FOG_PRESET_ERRORS,
  type FogPresetControls,
} from '../useFogPresetControls';

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
    managerError: null,
    setManagerError: vi.fn(),
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

  it('resyncs the Fog color field to the draft after Reset', () => {
    const baseMaterial = { ...preset.material, color: '#102030' };
    function Harness() {
      const [draft, setDraft] = useState<typeof baseMaterial>(baseMaterial);
      const c = controls({
        editor: { draft, sourcePresetId: null, error: null },
        updateDraft: patch =>
          setDraft(prev => ({ ...prev, ...patch }) as typeof baseMaterial),
        resetDraft: vi.fn(() => setDraft(baseMaterial)),
      });
      return <FogPresetPanel controls={c} />;
    }
    render(<Harness />);
    const field = screen.getByRole('textbox', { name: 'Fog color' });
    fireEvent.change(field, { target: { value: '#ff0000' } });
    expect(field).toHaveValue('#ff0000');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(field).toHaveValue('#102030');
  });

  it('Cancel restores without apply, and clears the preset name field on reopen', () => {
    const applyDraft = vi.fn();
    const saveDraftAsPreset = vi.fn(() => null);
    const updateSourcePreset = vi.fn(() => null);
    const cancelEditor = vi.fn();
    function freshEditor(): NonNullable<FogPresetControls['editor']> {
      return {
        draft: { ...preset.material, color: '#102030' },
        sourcePresetId: null,
        error: null,
      };
    }
    function Harness() {
      const [editor, setEditor] =
        useState<FogPresetControls['editor']>(freshEditor());
      const c = controls({
        editor,
        updateDraft: patch =>
          setEditor(
            prev =>
              prev && {
                ...prev,
                draft: { ...prev.draft, ...patch } as typeof prev.draft,
              }
          ),
        cancelEditor: vi.fn(() => {
          cancelEditor();
          setEditor(null);
        }),
        openEditor: vi.fn(() => setEditor(freshEditor())),
        applyDraft,
        saveDraftAsPreset,
        updateSourcePreset,
      });
      return <FogPresetPanel controls={c} />;
    }
    render(<Harness />);
    const dialog = screen.getByRole('dialog', { name: 'Fog material' });
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: 'Preset name' }),
      { target: { value: 'Crimson' } }
    );
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: 'Fog color' }),
      { target: { value: '#ff0000' } }
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(cancelEditor).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Fog material' })).toBeNull();
    expect(applyDraft).not.toHaveBeenCalled();
    expect(saveDraftAsPreset).not.toHaveBeenCalled();
    expect(updateSourcePreset).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Customize fog' }));
    const reopened = screen.getByRole('dialog', { name: 'Fog material' });
    expect(
      within(reopened).getByRole('textbox', { name: 'Preset name' })
    ).toHaveValue('');
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
    expect(
      within(dialog).getByRole('textbox', { name: 'Preset name' })
    ).toHaveValue('');
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

  it('surfaces a duplicate error as an alert under the list', () => {
    const longName = 'X'.repeat(60);
    const longPreset = {
      v: 1 as const,
      id: 'fp_long',
      name: longName,
      material: preset.material,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    };
    function Harness() {
      const [managerError, setManagerError] = useState<string | null>(null);
      const c = controls({
        managerOpen: true,
        library: [longPreset],
        duplicatePreset: vi.fn(() => FOG_PRESET_ERRORS.name),
        managerError,
        setManagerError,
      });
      return <FogPresetPanel controls={c} />;
    }
    render(<Harness />);
    const dialog = screen.getByRole('dialog', { name: 'Fog presets' });
    fireEvent.click(
      within(dialog).getByRole('button', { name: `Duplicate ${longName}` })
    );
    expect(screen.getByRole('alert')).toHaveTextContent(FOG_PRESET_ERRORS.name);
  });
});
