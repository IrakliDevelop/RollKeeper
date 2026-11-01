import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BattleMapLiveBanner } from './BattleMapLiveBanner';
import { InitiativeRollPrompt } from './InitiativeRollPrompt';
import { ToastContainer } from '@/components/ui/feedback/Toast';
import { SheetFloatingStack } from './SheetFloatingStack';

afterEach(cleanup);

describe('sheet floating surfaces', () => {
  it('shows a campaign landmark only for notices and keeps the stack in flow order', () => {
    const onHeightChange = vi.fn();
    const prompt = <div>Prompt</div>;
    const mapAccess = <div>Map access</div>;
    const toasts = <div>Toast</div>;
    const { rerender } = render(
      <SheetFloatingStack
        prompt={prompt}
        mapAccess={mapAccess}
        toasts={toasts}
        onHeightChange={onHeightChange}
      />
    );
    expect(
      screen.queryByRole('complementary', { name: 'Campaign notifications' })
    ).toBeNull();
    rerender(
      <SheetFloatingStack
        prompt={prompt}
        notifications={<div>Notice</div>}
        mapAccess={mapAccess}
        toasts={toasts}
        onHeightChange={onHeightChange}
      />
    );
    const stack = screen.getByTestId('sheet-floating-stack');
    expect(
      screen.getByRole('complementary', { name: 'Campaign notifications' })
    ).toHaveTextContent('Notice');
    expect(Array.from(stack.children).map(child => child.textContent)).toEqual([
      'Prompt',
      'Notice',
      'Map access',
      'Toast',
    ]);
  });

  it('keeps the initiative prompt, map access and toasts in one flow', () => {
    render(
      <div data-testid="floating-stack">
        <InitiativeRollPrompt
          embedded
          request={{
            requestId: 'r',
            encounterId: 'e',
            encounterName: 'Ruins',
            requestedAt: 1,
          }}
          modifier={2}
          onSubmit={vi.fn(async () => true)}
          onDismiss={vi.fn()}
        />
        <BattleMapLiveBanner
          embedded
          compact
          campaignCode="camp"
          battleMapId="map"
          characterId="hero"
        />
        <ToastContainer
          embedded
          toasts={[
            {
              id: 'toast',
              type: 'info',
              title: 'Saved',
              message: 'Sheet saved',
            },
          ]}
          onDismiss={vi.fn()}
        />
      </div>
    );
    const stack = screen.getByTestId('floating-stack');
    const prompt = within(stack)
      .getByText('Ruins: roll for initiative!')
      .closest('div.fixed, div.pointer-events-auto');
    const map = within(stack).getByRole('link', { name: 'Open battle map' });
    expect(prompt).not.toHaveClass('fixed');
    expect(map).not.toHaveClass('fixed');
    expect(within(stack).getAllByText('Saved').length).toBeGreaterThan(0);
  });
});
