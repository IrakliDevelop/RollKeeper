// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Spell } from '@/types/character';
import { NpcSpellDialog } from '../NpcSpellDialog';

vi.mock('@/hooks/useSpellsData', () => ({
  useSpellsData: () => ({
    spells: [],
    loading: false,
    error: null,
    searchResults: () => [],
    getSpellById: () => undefined,
    getSpellByName: () => undefined,
  }),
}));

afterEach(cleanup);

const spell: Spell = {
  id: 'spell-1',
  name: 'Fire Bolt',
  level: 0,
  school: 'Evocation',
  castingTime: '1 action',
  range: '120 feet',
  components: { verbal: true, somatic: true, material: false },
  duration: 'Instantaneous',
  description: 'A mote of fire.',
  freeCastMax: 2,
  freeCastsUsed: 1,
  tags: ['Signature'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

type DialogProps = React.ComponentProps<typeof NpcSpellDialog>;

function renderDialog(overrides: Partial<DialogProps> = {}) {
  const props: DialogProps = {
    open: true,
    mode: 'add',
    title: 'Add a spell to Mira',
    existingTags: ['Signature'],
    onSubmit: vi.fn(),
    onOpenChange: vi.fn(),
    ...overrides,
  };
  const view = render(<NpcSpellDialog {...props} />);
  return { props, ...view };
}

describe('NpcSpellDialog add mode', () => {
  it('shows the passed title and a labelled search field', () => {
    renderDialog();
    expect(
      screen.getByRole('heading', { name: 'Add a spell to Mira' })
    ).toBeInTheDocument();
    const search = screen.getByRole('textbox', { name: 'Search spells' });
    expect(search).toHaveAttribute('placeholder', 'Fireball');
  });

  it('disables "Add spell" until the spell has a name, then submits', () => {
    const { props } = renderDialog();
    const submit = screen.getByRole('button', { name: 'Add spell' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Spell Name/), {
      target: { value: 'Shield' },
    });
    fireEvent.change(screen.getByPlaceholderText('Add tag...'), {
      target: { value: 'Defense' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText('Add tag...'), {
      key: 'Enter',
    });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Shield', tags: ['Defense'] })
    );
  });

  it('has an outline Cancel and exactly one primary button', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' })
    ).toHaveAttribute('data-variant', 'outline');
    expect(dialog.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
  });

  it('shows an empty form when reopened after a submit', () => {
    const { props, rerender } = renderDialog();
    fireEvent.change(screen.getByLabelText(/Spell Name/), {
      target: { value: 'Shield' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add spell' }));
    rerender(<NpcSpellDialog {...props} open={false} />);
    rerender(<NpcSpellDialog {...props} open />);
    expect(screen.getByLabelText(/Spell Name/)).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Add spell' })).toBeDisabled();
  });
});

describe('NpcSpellDialog edit mode', () => {
  it('prefills from the spell and offers "Save spell"', () => {
    renderDialog({ mode: 'edit', title: 'Edit Fire Bolt', spell });
    expect(screen.getByLabelText(/Spell Name/)).toHaveValue('Fire Bolt');
    expect(screen.queryByRole('textbox', { name: 'Search spells' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Save spell' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Add spell' })).toBeNull();
  });

  it('keeps id, createdAt, freeCastsUsed and tags when the name changes', () => {
    const { props } = renderDialog({
      mode: 'edit',
      title: 'Edit Fire Bolt',
      spell,
    });
    fireEvent.change(screen.getByLabelText(/Spell Name/), {
      target: { value: 'Fire Bolt II' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save spell' }));
    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'spell-1',
        name: 'Fire Bolt II',
        createdAt: '2026-01-01T00:00:00.000Z',
        freeCastMax: 2,
        freeCastsUsed: 1,
        tags: ['Signature'],
      })
    );
  });
});
