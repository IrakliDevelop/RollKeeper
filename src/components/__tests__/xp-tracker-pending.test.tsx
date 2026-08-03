import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { XPTracker } from '@/components/shared/character/XPTracker';

describe('XPTracker pending level-up', () => {
  let mockHandlers: {
    onAddXP: (xpToAdd: number) => void;
    onSetXP: (newXP: number) => void;
  };

  beforeEach(() => {
    mockHandlers = {
      onAddXP: vi.fn(),
      onSetXP: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
  });
  it('shows the persistent pending badge when pendingLevelUp', () => {
    render(
      <XPTracker
        currentXP={300}
        currentLevel={1}
        pendingLevelUp
        onAddXP={mockHandlers.onAddXP}
        onSetXP={mockHandlers.onSetXP}
      />
    );
    expect(screen.getByText(/level up available/i)).toBeTruthy();
  });

  it('hides the badge when hideLevelUpAlert is set', () => {
    render(
      <XPTracker
        currentXP={300}
        currentLevel={1}
        pendingLevelUp
        hideLevelUpAlert
        onAddXP={mockHandlers.onAddXP}
        onSetXP={mockHandlers.onSetXP}
      />
    );
    expect(screen.queryByText(/level up available/i)).toBeNull();
  });

  it('shows no badge when not pending', () => {
    render(
      <XPTracker
        currentXP={100}
        currentLevel={1}
        onAddXP={mockHandlers.onAddXP}
        onSetXP={mockHandlers.onSetXP}
      />
    );
    expect(screen.queryByText(/level up available/i)).toBeNull();
  });

  it('replaces the to-next-level figure with a pending label while pending', () => {
    render(
      <XPTracker
        currentXP={300}
        currentLevel={1}
        pendingLevelUp
        onAddXP={mockHandlers.onAddXP}
        onSetXP={mockHandlers.onSetXP}
      />
    );
    const pendingLabels = screen.getAllByText(/level-up pending/i);
    expect(pendingLabels.length).toBeGreaterThan(0);
  });

  it('shows the normal to-next-level figure when not pending', () => {
    render(
      <XPTracker
        currentXP={0}
        currentLevel={1}
        onAddXP={mockHandlers.onAddXP}
        onSetXP={mockHandlers.onSetXP}
      />
    );
    const xpTexts = screen.getAllByText(/300/);
    expect(xpTexts.length).toBeGreaterThan(0); // 300 XP to level 2
  });
});
