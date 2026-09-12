// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CampaignNPC } from '@/types/encounter';
import { SavedCreaturePicker } from './SavedCreaturePicker';

const creatures: CampaignNPC[] = [
  {
    id: 'guard',
    campaignCode: 'TEST',
    name: 'North Gate Guard',
    group: 'City Watch',
    tags: ['human'],
    armorClass: '16',
    maxHp: 18,
    speed: '30 ft.',
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
  },
  {
    id: 'scout',
    campaignCode: 'TEST',
    name: 'Mosscloak Scout',
    group: 'Rangers',
    tags: ['elf'],
    armorClass: '14',
    maxHp: 15,
    speed: '35 ft.',
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
  },
];

afterEach(cleanup);

describe('SavedCreaturePicker', () => {
  it('advertises name, group, and tag search', () => {
    render(
      <SavedCreaturePicker
        creatures={creatures}
        emptyMessage="No creatures"
        onSelect={vi.fn()}
      />
    );

    expect(
      screen.getByRole('textbox', {
        name: /search saved creatures by name, group, or tag/i,
      })
    ).toHaveAttribute('placeholder', 'Search by name, group, or tag…');
  });

  it('filters a large saved-creature list by explicit group selection', async () => {
    const user = userEvent.setup();
    render(
      <SavedCreaturePicker
        creatures={creatures}
        emptyMessage="No creatures"
        onSelect={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole('combobox', {
        name: /filter saved creatures by group/i,
      })
    );
    await user.click(screen.getByRole('option', { name: 'Rangers' }));

    expect(screen.queryByText('North Gate Guard')).not.toBeInTheDocument();
    expect(screen.getByText('Mosscloak Scout')).toBeInTheDocument();
  });
});
