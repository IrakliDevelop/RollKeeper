// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Spell } from '@/types/character';
import { NpcSpellRow } from '../NpcSpellRow';

afterEach(cleanup);

function makeSpell(overrides: Partial<Spell> = {}): Spell {
  return {
    id: 'spell-1',
    name: 'Fire Bolt',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    description: 'A mote of fire.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderRow(
  spell: Spell,
  usage: 'play' | 'edit',
  handlers: Partial<React.ComponentProps<typeof NpcSpellRow>> = {}
) {
  return render(
    <ul>
      <NpcSpellRow spell={spell} usage={usage} {...handlers} />
    </ul>
  );
}

describe('NpcSpellRow badges', () => {
  it('shows "At will" for freeCastMax 0', () => {
    renderRow(makeSpell({ freeCastMax: 0 }), 'play');
    expect(screen.getByText('At will')).toBeInTheDocument();
  });

  it('shows remaining innate casts on a play surface', () => {
    renderRow(makeSpell({ freeCastMax: 2, freeCastsUsed: 2 }), 'play');
    const badge = screen.getByText('0 of 2 left');
    expect(badge).toHaveAttribute('data-variant', 'neutral');
  });

  it('never shows a negative remaining count', () => {
    renderRow(makeSpell({ freeCastMax: 1, freeCastsUsed: 2 }), 'play');
    expect(screen.getByText('0 of 1 left')).toBeInTheDocument();
  });

  it('shows the daily count on an edit surface', () => {
    renderRow(makeSpell({ freeCastMax: 2, freeCastsUsed: 2 }), 'edit');
    expect(screen.getByText('2 per day')).toBeInTheDocument();
    expect(screen.queryByText(/left/)).toBeNull();
  });

  it('marks concentration with the magic variant', () => {
    renderRow(makeSpell({ concentration: true }), 'play');
    expect(screen.getByText('Concentration')).toHaveAttribute(
      'data-variant',
      'magic'
    );
  });

  it('shows ritual and tags as badges and no letter codes', () => {
    renderRow(makeSpell({ ritual: true, tags: ['Signature', 'Fire'] }), 'play');
    expect(screen.getByText('Ritual')).toBeInTheDocument();
    expect(screen.getByText('Signature')).toHaveAttribute(
      'data-variant',
      'neutral'
    );
    expect(screen.getByText('Fire')).toBeInTheDocument();
    expect(screen.queryByText('C')).toBeNull();
    expect(screen.queryByText('L1')).toBeNull();
    expect(screen.queryByText('R')).toBeNull();
  });

  it('shows the school unless it is Unknown', () => {
    const { unmount } = renderRow(makeSpell(), 'play');
    expect(screen.getByText('Evocation')).toBeInTheDocument();
    unmount();
    renderRow(makeSpell({ school: 'Unknown' }), 'play');
    expect(screen.queryByText('Unknown')).toBeNull();
  });
});

describe('NpcSpellRow actions', () => {
  it('renders only the buttons whose handlers are passed', () => {
    renderRow(makeSpell(), 'play', { onCast: vi.fn(), onView: vi.fn() });
    expect(
      screen.getByRole('button', { name: 'Cast Fire Bolt' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'View Fire Bolt' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Fire Bolt' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Remove Fire Bolt' })
    ).toBeNull();
  });

  it('wires each handler and styles Remove as danger, the rest ghost', () => {
    const handlers = {
      onCast: vi.fn(),
      onView: vi.fn(),
      onEdit: vi.fn(),
      onRemove: vi.fn(),
    };
    renderRow(makeSpell(), 'edit', handlers);
    const remove = screen.getByRole('button', { name: 'Remove Fire Bolt' });
    expect(remove).toHaveAttribute('data-variant', 'danger');
    for (const name of ['Cast', 'View', 'Edit']) {
      const button = screen.getByRole('button', { name: `${name} Fire Bolt` });
      expect(button).toHaveAttribute('data-variant', 'ghost');
      fireEvent.click(button);
    }
    fireEvent.click(remove);
    expect(handlers.onCast).toHaveBeenCalledTimes(1);
    expect(handlers.onView).toHaveBeenCalledTimes(1);
    expect(handlers.onEdit).toHaveBeenCalledTimes(1);
    expect(handlers.onRemove).toHaveBeenCalledTimes(1);
  });

  it('has no title attributes and only aria-hidden icons', () => {
    const { container } = renderRow(makeSpell({ tags: ['Fire'] }), 'play', {
      onCast: vi.fn(),
      onView: vi.fn(),
      onEdit: vi.fn(),
      onRemove: vi.fn(),
    });
    expect(container.querySelector('[title]')).toBeNull();
    expect(container.querySelector('svg:not([aria-hidden="true"])')).toBeNull();
    expect(container.querySelectorAll('svg')).toHaveLength(4);
  });

  it('reports button elements through buttonRef', () => {
    const buttonRef = vi.fn();
    renderRow(makeSpell(), 'play', {
      onCast: vi.fn(),
      onEdit: vi.fn(),
      buttonRef,
    });
    expect(buttonRef).toHaveBeenCalledWith(
      'cast',
      screen.getByRole('button', { name: 'Cast Fire Bolt' })
    );
    expect(buttonRef).toHaveBeenCalledWith(
      'edit',
      screen.getByRole('button', { name: 'Edit Fire Bolt' })
    );
  });

  it('renders an li with the coarse-pointer row height', () => {
    const { container } = renderRow(makeSpell(), 'play');
    expect(container.querySelector('li')).toHaveClass(
      'pointer-coarse:min-h-11'
    );
  });
});
