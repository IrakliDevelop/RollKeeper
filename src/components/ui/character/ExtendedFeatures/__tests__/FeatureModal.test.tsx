import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FeatureModal from '@/components/ui/character/ExtendedFeatures/FeatureModal';
import type { ExtendedFeature } from '@/types/character';

const FEATURE: ExtendedFeature = {
  id: 'feat-action-surge',
  name: 'Action Surge',
  maxUses: 1,
  usedUses: 0,
  restType: 'short',
  sourceType: 'class',
  sourceDetail: 'Fighter 2',
  displayOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderModal(
  overrides: Partial<ExtendedFeature> = {},
  characterLevel = 2,
  onClose = vi.fn()
) {
  render(
    <FeatureModal
      feature={{ ...FEATURE, ...overrides }}
      isOpen
      characterLevel={characterLevel}
      onClose={onClose}
    />
  );
  return onClose;
}

describe('FeatureModal', () => {
  afterEach(cleanup);

  it('names the dialog after the feature and describes it with its source', () => {
    renderModal();
    expect(
      screen.getByRole('dialog', { name: 'Action Surge' })
    ).toHaveAccessibleDescription('Class Features · Fighter 2');

    cleanup();
    renderModal({ sourceDetail: undefined });
    expect(
      screen.getByRole('dialog', { name: 'Action Surge' })
    ).toHaveAccessibleDescription('Class Features');
  });

  it('shows uses left and when they come back', () => {
    renderModal();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Usage information' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === 'P' && el.textContent === '1 of 1 uses remaining'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Recharges on a short rest')).toBeInTheDocument();
  });

  it('marks a passive feature as always active, with no recharge line', () => {
    renderModal({ isPassive: true });
    expect(
      screen.getByText('Passive ability - always active')
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Recharges on/)).toBeNull();
  });

  it('marks a feature with no maximum as unlimited, with no recharge line', () => {
    renderModal({ maxUses: 0 });
    expect(screen.getByText('Unlimited uses')).toBeInTheDocument();
    expect(screen.queryByText(/^Recharges on/)).toBeNull();
  });

  it('renders the description as rich text', () => {
    renderModal({
      description:
        '<p>Take one more <strong>action</strong>.</p><ul><li>Once per turn</li></ul>',
    });
    expect(
      screen.getByRole('heading', { level: 3, name: 'Description' })
    ).toBeInTheDocument();
    expect(screen.getByText('action').tagName).toBe('STRONG');
    expect(screen.getByRole('listitem')).toHaveTextContent('Once per turn');
  });

  it('omits the description and details sections when there is nothing to show', () => {
    renderModal();
    expect(screen.queryByRole('heading', { name: 'Description' })).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'Additional details' })
    ).toBeNull();
  });

  it('lists scaling and category as terms', () => {
    renderModal(
      {
        scaleWithProficiency: true,
        proficiencyMultiplier: 2,
        category: 'Combat',
      },
      5
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'Additional details' })
    ).toBeInTheDocument();
    expect(screen.getByText('Scaling').tagName).toBe('DT');
    expect(screen.getByText('Proficiency bonus × 2')).toBeInTheDocument();
    expect(screen.getByText('Category').tagName).toBe('DT');
    expect(screen.getByText('Combat')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === 'P' && el.textContent === '6 of 6 uses remaining'
      )
    ).toBeInTheDocument();
  });

  it('offers only the Close button', () => {
    renderModal();
    const buttons = within(screen.getByRole('dialog')).getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName('Close');
  });

  it('calls onClose from the Close button', () => {
    const onClose = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
