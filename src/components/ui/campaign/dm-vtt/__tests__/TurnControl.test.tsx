import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TurnControl } from '@/components/ui/campaign/dm-vtt/TurnControl';
import { TooltipProvider } from '@/components/ui/primitives/Tooltip';

afterEach(() => cleanup());

function renderControl(onNext = vi.fn(), onPrev = vi.fn()) {
  render(
    <TooltipProvider>
      <TurnControl
        round={3}
        activeName="Goblin"
        onNext={onNext}
        onPrev={onPrev}
      />
    </TooltipProvider>
  );
  return { onNext, onPrev };
}

describe('TurnControl', () => {
  it('shows the round and the active name with Next as the one primary', () => {
    renderControl();

    expect(screen.getByText('Round 3')).toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next turn' })).toHaveAttribute(
      'data-variant',
      'primary'
    );
    expect(
      screen.getByRole('button', { name: 'Previous turn' })
    ).toHaveAttribute('data-variant', 'ghost');
    expect(screen.queryByText(/ROUND|NOW/)).not.toBeInTheDocument();
  });

  it('calls onNext and onPrev from the buttons', async () => {
    const user = userEvent.setup();
    const { onNext, onPrev } = renderControl();

    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await user.click(screen.getByRole('button', { name: 'Previous turn' }));

    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrev).toHaveBeenCalledOnce();
  });
});
