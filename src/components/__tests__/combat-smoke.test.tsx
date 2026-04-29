import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { HitDicePools } from '@/types/character';

afterEach(cleanup);

// ── Fixtures ────────────────────────────────────────────────────────────────

const mockHitDicePools: HitDicePools = {
  d10: { max: 5, used: 2 },
  d6: { max: 3, used: 0 },
};

// ── HitDiceTracker ──────────────────────────────────────────────────────────

describe('HitDiceTracker', () => {
  async function renderTracker(overrides: Record<string, unknown> = {}) {
    const { default: HitDiceTracker } = await import(
      '@/components/ui/character/HitDiceTracker'
    );
    const props = {
      hitDicePools: mockHitDicePools,
      onUseHitDie: vi.fn(),
      onRestoreHitDice: vi.fn(),
      onResetAllHitDice: vi.fn(),
      ...overrides,
    };
    return render(<HitDiceTracker {...props} />);
  }

  it('renders without crashing', async () => {
    await renderTracker();
    expect(screen.getAllByText('Hit Dice').length).toBeGreaterThanOrEqual(1);
  });

  it('displays die types and remaining counts', async () => {
    await renderTracker();
    expect(screen.getByText('D10')).toBeInTheDocument();
    expect(screen.getByText('3 / 5')).toBeInTheDocument();
    expect(screen.getByText('D6')).toBeInTheDocument();
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  it('shows Long Rest button', async () => {
    await renderTracker();
    expect(
      screen.getByRole('button', { name: /Long Rest/i })
    ).toBeInTheDocument();
  });
});

// ── ConditionBadge ──────────────────────────────────────────────────────────

describe('ConditionBadge', () => {
  async function renderBadge(overrides: Record<string, unknown> = {}) {
    const { ConditionBadge } = await import(
      '@/components/shared/combat/ConditionBadge'
    );
    const props = { name: 'Poisoned', ...overrides };
    return render(<ConditionBadge {...props} />);
  }

  it('renders without crashing', async () => {
    await renderBadge();
    expect(screen.getByText('Poisoned')).toBeInTheDocument();
  });

  it('displays stack count when > 1', async () => {
    await renderBadge({ stackCount: 3 });
    expect(screen.getByText('x3')).toBeInTheDocument();
  });

  it('calls onRemove when X button is clicked', async () => {
    const onRemove = vi.fn();
    await renderBadge({ onRemove });
    fireEvent.click(screen.getByRole('button', { name: /Remove Poisoned/i }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

// ── HPBar ───────────────────────────────────────────────────────────────────

describe('HPBar', () => {
  async function renderBar(overrides: Record<string, unknown> = {}) {
    const { HPBar } = await import('@/components/shared/combat/HPBar');
    const props = { current: 30, max: 40, ...overrides };
    return render(<HPBar {...props} />);
  }

  it('renders without crashing', async () => {
    await renderBar();
    expect(screen.getByText(/30\/40/)).toBeInTheDocument();
  });

  it('shows label with current/max HP by default', async () => {
    await renderBar();
    expect(screen.getByText(/30\/40/)).toBeInTheDocument();
  });

  it('hides label when showLabel is false', async () => {
    await renderBar({ showLabel: false });
    expect(screen.queryByText(/30\/40/)).not.toBeInTheDocument();
  });

  it('shows temp HP when provided', async () => {
    await renderBar({ temp: 5 });
    expect(screen.getByText('+5')).toBeInTheDocument();
  });
});
