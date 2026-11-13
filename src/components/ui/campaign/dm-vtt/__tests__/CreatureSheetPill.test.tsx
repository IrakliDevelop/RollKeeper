import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { CreatureSheetPill } from '../CreatureSheetPill';

afterEach(() => cleanup());

describe('CreatureSheetPill', () => {
  it('names the button from its visible text', () => {
    render(<CreatureSheetPill name="Goblin" onOpen={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Open Goblin sheet' });
    expect(button).toHaveTextContent('Open Goblin sheet');
  });

  it('calls onOpen when clicked', () => {
    const onOpen = vi.fn();
    render(<CreatureSheetPill name="Goblin" onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Goblin sheet' }));

    expect(onOpen).toHaveBeenCalledOnce();
  });
});
