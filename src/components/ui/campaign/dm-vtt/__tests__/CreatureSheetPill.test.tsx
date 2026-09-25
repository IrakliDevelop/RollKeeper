import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { CreatureSheetPill } from '../CreatureSheetPill';

afterEach(() => cleanup());

describe('CreatureSheetPill', () => {
  it('renders the creature name and an accessible label', () => {
    render(<CreatureSheetPill name="Goblin" onOpen={vi.fn()} />);

    expect(screen.getByText('Sheet · Goblin')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open Goblin sheet' })
    ).toBeInTheDocument();
  });

  it('calls onOpen when clicked', () => {
    const onOpen = vi.fn();
    render(<CreatureSheetPill name="Goblin" onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Goblin sheet' }));

    expect(onOpen).toHaveBeenCalledOnce();
  });
});
