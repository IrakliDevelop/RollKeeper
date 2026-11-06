import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CampaignSettingsSection,
  type CampaignSettingsSectionProps,
} from './CampaignSettingsSection';

const onOpenChange = vi.fn();
const onBannerChange = vi.fn();
const onPageLayoutChange = vi.fn();
const onStackableInspirationChange = vi.fn();
const onCustomCounterLabelChange = vi.fn();
const onNpcSpellSlotModeChange = vi.fn();

function props(
  overrides: Partial<CampaignSettingsSectionProps> = {}
): CampaignSettingsSectionProps {
  return {
    campaignCode: 'K7QX2M',
    open: true,
    onOpenChange,
    onBannerChange,
    pageLayout: 'standard',
    onPageLayoutChange,
    stackableInspiration: false,
    onStackableInspirationChange,
    onCustomCounterLabelChange,
    npcSpellSlotMode: 'inline',
    onNpcSpellSlotModeChange,
    ...overrides,
  };
}

function renderSettings(overrides: Partial<CampaignSettingsSectionProps> = {}) {
  return render(<CampaignSettingsSection {...props(overrides)} />);
}

const field = () => screen.getByRole('textbox', { name: 'Player counter' });

describe('CampaignSettingsSection', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('opens and closes from its heading', () => {
    renderSettings({ open: false });
    const toggle = screen.getByRole('button', { name: 'Campaign settings' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Player counter')).toBeNull();
    fireEvent.click(toggle);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('shows the banner row with its size limit', () => {
    renderSettings();
    expect(screen.getByText('Banner image')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Shown on this page and on the campaign card. Up to 10 MB.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add image' })
    ).toBeInTheDocument();
    expect(screen.getByText('Banner image').closest('.pb-4')).toHaveClass(
      'lg:flex-col',
      'lg:items-stretch'
    );
  });

  it('offers the three page layouts with the saved one chosen', () => {
    renderSettings({ pageLayout: 'banner' });
    const group = screen.getByRole('radiogroup', { name: 'Page layout' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map(radio => radio.getAttribute('value'))).toEqual([
      'standard',
      'banner',
      'classic',
    ]);
    expect(within(group).getByRole('radio', { name: 'Banner' })).toBeChecked();
    expect(
      within(group).getByRole('radio', { name: 'Classic' })
    ).toHaveAccessibleDescription(
      'The layout from before the redesign, with coloured page tiles.'
    );
  });

  it('reports the chosen page layout', async () => {
    renderSettings();
    await user.click(screen.getByRole('radio', { name: 'Classic' }));
    expect(onPageLayoutChange).toHaveBeenCalledWith('classic');
  });

  it('describes and toggles stackable heroic inspiration', () => {
    renderSettings();
    const sw = screen.getByRole('switch', {
      name: 'Stackable heroic inspiration',
    });
    expect(sw).toHaveAccessibleDescription(
      'Players can hold more than one heroic inspiration. When off, they hold at most one.'
    );
    fireEvent.click(sw);
    expect(onStackableInspirationChange).toHaveBeenCalledWith(true);
  });

  it('labels the player counter field', () => {
    renderSettings();
    expect(field()).toHaveAccessibleDescription(
      'A tally you keep for each player, such as Desperation. Leave it empty to hide the counter.'
    );
    expect(field()).toHaveAttribute('placeholder', 'Desperation');
  });

  it('commits the trimmed label on blur', async () => {
    renderSettings();
    await user.type(field(), '  Doom  ');
    await user.tab();
    expect(onCustomCounterLabelChange).toHaveBeenCalledExactlyOnceWith('Doom');
  });

  it('commits on Enter', async () => {
    renderSettings();
    await user.type(field(), 'Doom{Enter}');
    expect(onCustomCounterLabelChange).toHaveBeenCalledWith('Doom');
  });

  it('commits once when Enter is followed by blur', async () => {
    renderSettings();
    await user.type(field(), 'Doom{Enter}');
    await user.tab();
    expect(onCustomCounterLabelChange).toHaveBeenCalledExactlyOnceWith('Doom');
  });

  it('clears the counter when the field is emptied', async () => {
    renderSettings({ customCounterLabel: 'Desperation' });
    await user.clear(field());
    await user.tab();
    expect(onCustomCounterLabelChange).toHaveBeenCalledWith(undefined);
  });

  it('restores the saved label on Escape', async () => {
    renderSettings({ customCounterLabel: 'Desperation' });
    await user.type(field(), 'X{Escape}');
    expect(field()).toHaveValue('Desperation');
    await user.tab();
    expect(onCustomCounterLabelChange).not.toHaveBeenCalled();
  });

  it('does not commit an unchanged label', async () => {
    renderSettings({ customCounterLabel: 'Desperation' });
    await user.click(field());
    await user.tab();
    expect(onCustomCounterLabelChange).not.toHaveBeenCalled();
  });

  it('follows a label changed elsewhere while not editing', () => {
    const { rerender } = renderSettings({ customCounterLabel: 'Desperation' });
    rerender(
      <CampaignSettingsSection {...props({ customCounterLabel: 'Doom' })} />
    );
    expect(field()).toHaveValue('Doom');
  });

  it("doesn't overwrite a label changed elsewhere while focused but untouched", async () => {
    const { rerender } = renderSettings({ customCounterLabel: 'Desperation' });
    await user.click(field());
    rerender(
      <CampaignSettingsSection {...props({ customCounterLabel: 'Doom' })} />
    );
    expect(field()).toHaveValue('Doom');
    await user.tab();
    expect(onCustomCounterLabelChange).not.toHaveBeenCalled();
  });

  it('keeps the draft when the label changes mid-edit', async () => {
    const { rerender } = renderSettings({ customCounterLabel: 'Desperation' });
    await user.clear(field());
    await user.type(field(), 'Fear');
    rerender(
      <CampaignSettingsSection {...props({ customCounterLabel: 'Doom' })} />
    );
    expect(field()).toHaveValue('Fear');
  });

  it('offers the NPC spell slot setting as the last row', () => {
    renderSettings();
    const group = screen.getByRole('radiogroup', { name: 'NPC spell slots' });
    expect(
      within(group).getByRole('radio', { name: 'Beside each spell level' })
    ).toBeChecked();
    expect(
      within(group).getByRole('radio', { name: 'In a separate tracker' })
    ).not.toBeChecked();
    const rows = group.closest('.divide-y')!.children;
    expect(rows[rows.length - 1]).toContainElement(group);
    expect(rows[rows.length - 2]).toHaveClass('py-4');
  });

  it('reports the chosen NPC spell slot mode', async () => {
    const { rerender } = renderSettings();
    await user.click(
      screen.getByRole('radio', { name: 'In a separate tracker' })
    );
    expect(onNpcSpellSlotModeChange).toHaveBeenLastCalledWith('tracker');
    rerender(
      <CampaignSettingsSection {...props({ npcSpellSlotMode: 'tracker' })} />
    );
    await user.click(
      screen.getByRole('radio', { name: 'Beside each spell level' })
    );
    expect(onNpcSpellSlotModeChange).toHaveBeenLastCalledWith('inline');
  });
});
