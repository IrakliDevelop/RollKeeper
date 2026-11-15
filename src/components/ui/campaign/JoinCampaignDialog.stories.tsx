import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { JoinCampaignDialog } from './JoinCampaignDialog';
import type { PlayerCharacter } from '@/store/playerStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function makePlayerCharacter(
  id: string,
  name: string,
  className: string,
  level: number
): PlayerCharacter {
  return {
    id,
    name,
    race: 'Human',
    class: className,
    level,
    createdAt: NOW,
    updatedAt: NOW,
    lastPlayed: NOW,
    characterData: makeCharacter({ name }),
    tags: [],
    isArchived: false,
  };
}

const CHARACTERS = [
  makePlayerCharacter('char-1', 'Mira', 'Fighter', 5),
  makePlayerCharacter('char-2', 'Tam', 'Rogue', 3),
];

/** The code and character form a player fills in to join a DM's campaign. */
const meta = {
  title: 'Campaign/JoinCampaignDialog',
  component: JoinCampaignDialog,
  args: {
    open: true,
    onOpenChange: fn(),
    onJoin: fn(),
    characters: CHARACTERS,
  },
  parameters: { a11y: { test: 'error', context: { include: ['body'] } } },
} satisfies Meta<typeof JoinCampaignDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);

/** The dialog zooms and fades in; measure and assert after that. */
async function openDialog() {
  const dialog = await body().findByRole('dialog', { name: 'Join campaign' });
  await waitFor(() => expect(dialog.getAnimations()).toHaveLength(0));
  return dialog;
}

const PHONE = {
  viewport: {
    options: {
      phone: {
        name: 'Phone',
        styles: { width: '390px', height: '844px' },
        type: 'mobile',
      },
    },
  },
} as const;

const PHONE_GLOBALS = { viewport: { value: 'phone', isRotated: false } };

export const Default: Story = {
  play: async () => {
    await openDialog();
    await expect(
      document.body.querySelectorAll('[data-variant="primary"]')
    ).toHaveLength(1);
  },
};

export const MissingCode: Story = {
  play: async () => {
    await openDialog();
    const screen = body();
    await userEvent.click(
      screen.getByRole('button', { name: 'Join campaign' })
    );
    await expect(
      screen.getByRole('textbox', { name: 'Campaign code' })
    ).toHaveAccessibleDescription('Enter the campaign code.');
    await expect(screen.queryByRole('alert')).toBeNull();
  },
};

export const Dark: Story = {
  args: Default.args,
  globals: { theme: 'dark' },
};

export const Blue: Story = {
  args: Default.args,
  globals: { theme: 'blue' },
};

/** On a 390px phone the dialog never scrolls sideways. */
export const Phone: Story = {
  parameters: PHONE,
  globals: PHONE_GLOBALS,
  play: async () => {
    const dialog = await openDialog();
    await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth);
  },
};

/** On a coarse pointer the code field and both buttons are 44px targets. */
export const Touch: Story = {
  parameters: PHONE,
  globals: PHONE_GLOBALS,
  play: async () => {
    await openDialog();
    const screen = body();
    const targets = [
      screen.getByRole('textbox', { name: 'Campaign code' }),
      screen.getByRole('button', { name: 'Cancel' }),
      screen.getByRole('button', { name: 'Join campaign' }),
    ];
    const restore = emulateCoarsePointer();
    try {
      for (const target of targets) {
        await expect(
          target.getBoundingClientRect().height
        ).toBeGreaterThanOrEqual(44);
      }
    } finally {
      restore();
    }
  },
};
