import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react';

import { SheetHeader } from '../SheetHeader';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';

beforeEach(() => {
  const base = useCharacterStore.getState().character;
  useCharacterStore.getState().loadCharacterState({
    ...base,
    name: 'Kaelen Voss',
    race: 'Half-Elf',
    background: 'Outlander',
    concentration: { isConcentrating: true, spellName: "Hunter's Mark" },
  } as CharacterState);
});
afterEach(() => cleanup());

const props = () => ({
  locked: true,
  onToggleLock: vi.fn(),
  onClose: vi.fn(),
  onShortRest: vi.fn(),
  onLongRest: vi.fn(),
});

describe('SheetHeader', () => {
  it('shows name and concentration chip', () => {
    render(<SheetHeader {...props()} />);
    expect(
      screen.getByRole('heading', { name: 'Kaelen Voss' })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Concentrating on Hunter's Mark").closest('[data-kind]')
    ).toHaveAttribute('data-kind', 'concentration');
  });

  it('shows conditions, exhaustion and inspiration as words only', () => {
    const base = useCharacterStore.getState().character;
    useCharacterStore.getState().loadCharacterState({
      ...base,
      heroicInspiration: { count: 1 },
      conditionsAndDiseases: {
        ...base.conditionsAndDiseases,
        activeConditions: [
          { id: 'a', name: 'Prone', source: 'self' },
          { id: 'b', name: 'Exhaustion', count: 2, source: 'self' },
        ],
      },
    } as unknown as CharacterState);
    render(<SheetHeader {...props()} />);
    expect(screen.getByText('Prone').closest('[data-kind]')).toHaveAttribute(
      'data-kind',
      'condition'
    );
    expect(screen.getByText('Exhaustion 2')).toBeInTheDocument();
    expect(screen.getByText('Inspired')).toBeInTheDocument();
    expect(screen.getByText('Inspired').querySelector('svg')).toBeNull();
  });

  it('toggles lock, closes, and requests rests', () => {
    const p = props();
    render(<SheetHeader {...p} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Edit sheet' }));
    fireEvent.click(screen.getByRole('button', { name: /close sheet/i }));
    fireEvent.click(screen.getByRole('button', { name: /short rest/i }));
    fireEvent.click(screen.getByRole('button', { name: /long rest/i }));
    expect(p.onToggleLock).toHaveBeenCalled();
    expect(p.onClose).toHaveBeenCalled();
    expect(p.onShortRest).toHaveBeenCalled();
    expect(p.onLongRest).toHaveBeenCalled();
  });

  it('pins the level badge to the portrait wrapper, which does not stretch', () => {
    render(<SheetHeader {...props()} />);
    const portrait = screen.getByTestId('sheet-portrait');
    expect(portrait).toHaveClass('self-start');
    expect(portrait).toHaveTextContent(/Character level \d+/);
    expect(within(portrait).queryByTitle(/Character level/)).toBeNull();
  });

  it('gives Close no hover title', () => {
    render(<SheetHeader {...props()} />);
    expect(
      screen.getByRole('button', { name: /close sheet/i })
    ).not.toHaveAttribute('title');
  });

  it('shows the Edit sheet switch off while locked and on while editing', () => {
    const { rerender } = render(<SheetHeader {...props()} />);
    expect(screen.getByRole('switch', { name: 'Edit sheet' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
    rerender(<SheetHeader {...props()} locked={false} />);
    expect(screen.getByRole('switch', { name: 'Edit sheet' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('has no Locked or Editing button any more', () => {
    render(<SheetHeader {...props()} />);
    expect(
      screen.queryByRole('button', { name: /locked|editing/i })
    ).toBeNull();
    expect(screen.queryByTitle(/unlock to edit|lock the sheet/i)).toBeNull();
  });
});
