import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { InitiativeRollPrompt } from '../InitiativeRollPrompt';
import type { InitiativeRollRequest } from '@/types/sharedState';

const req: InitiativeRollRequest = {
  requestId: 'r1',
  encounterId: 'e1',
  encounterName: 'Dragon Lair',
  requestedAt: 1,
};

describe('InitiativeRollPrompt', () => {
  afterEach(() => cleanup());

  it('shows the encounter name in the heading', () => {
    render(
      <InitiativeRollPrompt
        request={req}
        modifier={3}
        onSubmit={vi.fn(async () => true)}
        onDismiss={vi.fn()}
      />
    );
    expect(
      screen.getByText('Dragon Lair: roll for initiative!')
    ).toBeInTheDocument();
  });

  it('rolls d20 and computes the total with modifier', async () => {
    vi.spyOn(global.Math, 'random').mockReturnValue(0.5);
    render(
      <InitiativeRollPrompt
        request={req}
        modifier={3}
        onSubmit={vi.fn(async () => true)}
        onDismiss={vi.fn()}
      />
    );

    const rollButton = screen.getByRole('button', { name: /Roll d20/i });
    const { default: userEvent } = await import('@testing-library/user-event');
    await userEvent.click(rollButton);

    // Math.random() 0.5 → Math.floor(0.5 * 20) + 1 = 11
    // 11 + modifier 3 = 14
    const input = screen.getByLabelText('Initiative total');
    expect((input as HTMLInputElement).value).toBe('14');

    // Breakdown shows 🎲 11 + 3
    expect(screen.getByText('🎲 11 + 3')).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('allows typing a value and calling onSubmit on Confirm', async () => {
    const onSubmit = vi.fn(async () => true);
    render(
      <InitiativeRollPrompt
        request={req}
        modifier={3}
        onSubmit={onSubmit}
        onDismiss={vi.fn()}
      />
    );

    const input = screen.getByLabelText('Initiative total');
    const { default: userEvent } = await import('@testing-library/user-event');

    await userEvent.type(input, '18');
    const confirmButton = screen.getByRole('button', { name: /Confirm/i });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(18);
    });
  });

  it('disables Confirm when input is empty or non-numeric', async () => {
    render(
      <InitiativeRollPrompt
        request={req}
        modifier={3}
        onSubmit={vi.fn(async () => true)}
        onDismiss={vi.fn()}
      />
    );

    const confirmButton = screen.getByRole('button', { name: /Confirm/i });
    expect(confirmButton).toBeDisabled();

    const input = screen.getByLabelText('Initiative total');
    const { default: userEvent } = await import('@testing-library/user-event');

    // Type non-numeric text
    await userEvent.type(input, 'abc');
    expect(confirmButton).toBeDisabled();

    // Clear and type numeric
    await userEvent.clear(input);
    await userEvent.type(input, '15');
    expect(confirmButton).not.toBeDisabled();
  });

  it('shows error and keeps prompt open when onSubmit resolves false', async () => {
    const onSubmit = vi.fn(async () => false);
    const { container } = render(
      <InitiativeRollPrompt
        request={req}
        modifier={3}
        onSubmit={onSubmit}
        onDismiss={vi.fn()}
      />
    );

    const input = screen.getByLabelText('Initiative total');
    const { default: userEvent } = await import('@testing-library/user-event');

    await userEvent.type(input, '18');
    const confirmButton = screen.getByRole('button', { name: /Confirm/i });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't send — try again.")
      ).toBeInTheDocument();
    });

    // Prompt is still mounted
    expect(
      screen.getByText('Dragon Lair: roll for initiative!')
    ).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', async () => {
    const onDismiss = vi.fn();
    render(
      <InitiativeRollPrompt
        request={req}
        modifier={3}
        onSubmit={vi.fn(async () => true)}
        onDismiss={onDismiss}
      />
    );

    const dismissButton = screen.getByRole('button', { name: /Dismiss/i });
    const { default: userEvent } = await import('@testing-library/user-event');
    await userEvent.click(dismissButton);

    expect(onDismiss).toHaveBeenCalled();
  });

  it('clears breakdown and error when input changes', async () => {
    vi.spyOn(global.Math, 'random').mockReturnValue(0.5);
    render(
      <InitiativeRollPrompt
        request={req}
        modifier={3}
        onSubmit={vi.fn(async () => true)}
        onDismiss={vi.fn()}
      />
    );

    const rollButton = screen.getByRole('button', { name: /Roll d20/i });
    const { default: userEvent } = await import('@testing-library/user-event');
    await userEvent.click(rollButton);

    expect(screen.getByText('🎲 11 + 3')).toBeInTheDocument();

    const input = screen.getByLabelText('Initiative total');
    await userEvent.clear(input);
    await userEvent.type(input, '20');

    // Breakdown is cleared
    expect(screen.queryByText(/🎲/)).not.toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('handles negative modifier in breakdown correctly', async () => {
    vi.spyOn(global.Math, 'random').mockReturnValue(0.5);
    render(
      <InitiativeRollPrompt
        request={req}
        modifier={-2}
        onSubmit={vi.fn(async () => true)}
        onDismiss={vi.fn()}
      />
    );

    const rollButton = screen.getByRole('button', { name: /Roll d20/i });
    const { default: userEvent } = await import('@testing-library/user-event');
    await userEvent.click(rollButton);

    // Breakdown shows 🎲 11 − 2 (with minus sign for negative)
    expect(screen.getByText('🎲 11 − 2')).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
