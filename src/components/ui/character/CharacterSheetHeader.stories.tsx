import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect, useState } from 'react';
import { expect, fn, mocked, waitFor, within } from 'storybook/test';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getPublicAuthConfig } from '@/lib/supabase/authConfig';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { SyncIndicator } from '@/components/ui/campaign/SyncIndicator';
import { Button } from '@/components/ui/forms';
import { useCharacterStore } from '@/store/characterStore';
import { remountOnTheme } from '@/components/ui/foundations/remountOnTheme';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import CharacterSheetHeader from './CharacterSheetHeader';
import { SheetModeProvider, useSheetModeState } from './SheetMode';
import type { SaveStatus } from '@/types/character';

/** The sizes a story picks with `globals: PHONE`, `IPAD_PORTRAIT` or `IPAD_LANDSCAPE`. */
const VIEWPORTS = {
  phone: {
    name: 'Phone',
    styles: { width: '390px', height: '844px' },
    type: 'mobile',
  },
  ipadPortrait: {
    name: 'iPad portrait',
    styles: { width: '820px', height: '1180px' },
    type: 'tablet',
  },
  ipadLandscape: {
    name: 'iPad landscape',
    styles: { width: '1180px', height: '820px' },
    type: 'tablet',
  },
} as const;

const PHONE = { viewport: { value: 'phone', isRotated: false } };
const IPAD_PORTRAIT = { viewport: { value: 'ipadPortrait', isRotated: false } };
const IPAD_LANDSCAPE = {
  viewport: { value: 'ipadLandscape', isRotated: false },
};

interface HarnessProps {
  /** Start the story in edit mode, as if the switch had been turned on. */
  initialEditing: boolean;
  campaign?: boolean;
  /** A long name makes the name compete with the back link for room. */
  characterName: string;
  saveStatus?: SaveStatus;
  lastSaved?: Date | null;
}

function Harness({
  initialEditing,
  characterName,
  campaign,
  saveStatus = 'saved',
  lastSaved = null,
}: HarnessProps) {
  const mode = useSheetModeState('story-character');
  const { setEditing } = mode;
  useEffect(() => {
    if (initialEditing) setEditing(true);
  }, [initialEditing, setEditing]);

  return (
    <SheetModeProvider value={mode}>
      <CharacterSheetHeader
        characterId="story-character"
        characterName={characterName}
        characterRace="Dwarf"
        characterClass="Fighter 3"
        characterLevel={3}
        characterAlignment="Lawful Good"
        characterCreatureType="Humanoid"
        saveStatus={saveStatus}
        lastSaved={lastSaved}
        hasUnsavedChanges={false}
        onManualSave={fn()}
        onExport={fn()}
        onShowResetModal={fn()}
        onUpdateName={fn()}
        onAddToast={fn()}
        extraHeaderContent={
          campaign ? (
            <SyncIndicator
              syncStatus="synced"
              lastSyncedAt={null}
              campaignCode="FAKE03"
              campaignName="Synthetic campaign"
              autoSync
              syncEnabled
              onSyncNow={fn()}
              onToggleAutoSync={fn()}
              onLeaveCampaign={fn()}
              characterData={useCharacterStore.getState().character}
              shareHpWithParty
              onToggleShareHp={fn()}
              sharePartyView={false}
              onSharePartyViewChange={fn()}
            />
          ) : undefined
        }
      />
    </SheetModeProvider>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Character/CharacterSheetHeader',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    a11y: {
      test: 'error',
    },
    viewport: { options: VIEWPORTS },
  },
  beforeEach: ({ parameters }) => {
    mocked(getPublicAuthConfig).mockReturnValue({
      url: 'http://auth-fake.localhost',
      publishableKey: 'synthetic-key',
    });
    const session = parameters.signedIn
      ? ({ user: { email: 'mira@example.invalid' } } as Session)
      : null;
    mocked(createSupabaseBrowserClient).mockReturnValue({
      auth: {
        onAuthStateChange: (
          callback: (event: AuthChangeEvent, session: Session | null) => void
        ) => {
          callback('INITIAL_SESSION', session);
          return { data: { subscription: { unsubscribe: fn() } } };
        },
      },
    } as unknown as ReturnType<typeof createSupabaseBrowserClient>);
  },
  globals: IPAD_LANDSCAPE,
  args: {
    initialEditing: false,
    characterName: 'Mira Vale — Synthetic Acceptance',
  },
  decorators: [remountOnTheme],
};

export default meta;
type Story = StoryObj<typeof meta>;

function barOf(canvasElement: HTMLElement) {
  const toggle = within(canvasElement).getByRole('switch', {
    name: 'Edit sheet',
  });
  return toggle.closest('header')!;
}

async function checkBar(canvasElement: HTMLElement) {
  const bar = barOf(canvasElement);
  // Both the sticky bar and page head fit at every supported width.
  await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
    window.innerWidth
  );
  await expect(within(canvasElement).getAllByRole('banner')).toHaveLength(1);
  await expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth);
  await expect(bar.getBoundingClientRect().right).toBeLessThanOrEqual(
    window.innerWidth + 0.5
  );
}

/** iPad widths show the switch label; the phone hides it visually (E1). */
async function checkLabelShown(canvasElement: HTMLElement) {
  const label = within(canvasElement).getByText('Edit sheet');
  await expect(label.getBoundingClientRect().width).toBeGreaterThan(1);
  await checkBackLinkOneLine(canvasElement);
}

/** The back link keeps its natural width; the character name gives way. */
async function checkBackLinkOneLine(canvasElement: HTMLElement) {
  const label = within(canvasElement).getByText('Characters');
  const button = label.closest('a')!;
  await expect(label.getClientRects().length).toBe(1);
  await expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth);
  // A wrapped label is a taller block, not a second client rect.
  const lineHeight = button.getBoundingClientRect().height;
  await expect(label.getBoundingClientRect().height).toBeLessThanOrEqual(
    lineHeight + 1
  );
}

/** Below sm the label is a 1×1 sr-only box but still names the switch. */
async function checkLabelHidden(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const box = canvas.getByText('Edit sheet').getBoundingClientRect();
  await expect(Math.round(box.width)).toBe(1);
  await expect(Math.round(box.height)).toBe(1);
  await expect(
    canvas.getByRole('switch', { name: 'Edit sheet' })
  ).toBeInTheDocument();
}

/** Edit mode shows the notice inside the sticky bar. */
async function checkNotice(canvasElement: HTMLElement) {
  const notice = within(canvasElement).getByText('Editing sheet');
  await expect(notice).toBeVisible();
  await expect(barOf(canvasElement)).toContainElement(notice);
}

export const PlayPhone: Story = {
  globals: PHONE,
  play: async ({ canvasElement }) => {
    await checkBar(canvasElement);
    await checkLabelHidden(canvasElement);
  },
};

export const EditPhone: Story = {
  args: { initialEditing: true },
  globals: PHONE,
  play: async ({ canvasElement }) => {
    await checkBar(canvasElement);
    await checkLabelHidden(canvasElement);
    await checkNotice(canvasElement);
  },
};

export const EditPhoneDark: Story = {
  ...EditPhone,
  globals: { ...PHONE, theme: 'dark' },
};

export const PlayIpadPortrait: Story = {
  globals: IPAD_PORTRAIT,
  play: async ({ canvasElement }) => {
    await checkBar(canvasElement);
    await checkLabelShown(canvasElement);
  },
};

export const EditIpadPortrait: Story = {
  args: { initialEditing: true },
  globals: IPAD_PORTRAIT,
  play: async ({ canvasElement }) => {
    await checkBar(canvasElement);
    await checkLabelShown(canvasElement);
    await checkNotice(canvasElement);
  },
};

export const PlayIpadLandscape: Story = {
  globals: IPAD_LANDSCAPE,
  play: async ({ canvasElement }) => {
    await checkBar(canvasElement);
    await checkLabelShown(canvasElement);
  },
};

export const EditIpadLandscape: Story = {
  args: { initialEditing: true },
  globals: IPAD_LANDSCAPE,
  play: async ({ canvasElement }) => {
    await checkBar(canvasElement);
    await checkLabelShown(canvasElement);
    await checkNotice(canvasElement);
    // The published bar height includes the "Editing sheet" row.
    const bar = barOf(canvasElement);
    await waitFor(() => {
      const published = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          '--app-header-height'
        )
      );
      expect(
        Math.abs(published - bar.getBoundingClientRect().height)
      ).toBeLessThanOrEqual(1);
    });
  },
};

/** On a phone with touch the switch's hit area is 44×44 and clear of the back link. */
export const TouchTargets: Story = {
  globals: PHONE,
  beforeEach: () => emulateCoarsePointer(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('switch', { name: 'Edit sheet' });
    const after = getComputedStyle(toggle, '::after');
    const width = parseFloat(after.width);
    const height = parseFloat(after.height);
    await expect(width).toBeGreaterThanOrEqual(43.5);
    await expect(height).toBeGreaterThanOrEqual(43.5);

    // The ::after is centred on the switch track.
    const box = toggle.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const area = {
      left: x - width / 2,
      right: x + width / 2,
      top: y - height / 2,
      bottom: y + height / 2,
    };
    const back = canvas
      .getByRole('link', { name: 'Characters' })
      .getBoundingClientRect();
    const overlaps =
      Math.round(back.left) < Math.round(area.right) &&
      Math.round(area.left) < Math.round(back.right) &&
      Math.round(back.top) < Math.round(area.bottom) &&
      Math.round(area.top) < Math.round(back.bottom);
    await expect(overlaps).toBe(false);
  },
};

async function checkPopulatedPhone(
  canvasElement: HTMLElement,
  signedIn: boolean
) {
  const canvas = within(canvasElement);
  await canvas.findByRole('button', {
    name: signedIn ? 'Account menu for mira@example.invalid' : 'Sign in',
  });
  await checkBar(canvasElement);
  const buttons = [
    ...canvasElement.querySelectorAll<HTMLButtonElement>('header button'),
  ];
  const area = (button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect();
    if (button.getAttribute('role') !== 'switch') return rect;
    const after = getComputedStyle(button, '::after');
    const width = parseFloat(after.width),
      height = parseFloat(after.height);
    return {
      width,
      height,
      left: rect.left + (rect.width - width) / 2,
      right: rect.right + (width - rect.width) / 2,
      top: rect.top + (rect.height - height) / 2,
      bottom: rect.bottom + (height - rect.height) / 2,
    };
  };
  for (const button of buttons) {
    const rect = area(button);
    await expect(rect.width).toBeGreaterThanOrEqual(43.5);
    await expect(rect.height).toBeGreaterThanOrEqual(43.5);
    for (const other of buttons) {
      if (button === other) continue;
      const b = area(other);
      await expect(
        rect.left < b.right - 0.5 &&
          rect.right > b.left + 0.5 &&
          rect.top < b.bottom - 0.5 &&
          rect.bottom > b.top + 0.5
      ).toBe(false);
    }
  }
  const bar = barOf(canvasElement);
  await waitFor(() =>
    expect(
      Math.abs(
        parseFloat(
          document.documentElement.style.getPropertyValue('--app-header-height')
        ) - bar.getBoundingClientRect().height
      )
    ).toBeLessThan(1)
  );
}
export const CampaignSignedOutPhone: Story = {
  args: { campaign: true },
  globals: PHONE,
  beforeEach: () => emulateCoarsePointer(),
  play: async ({ canvasElement }) => checkPopulatedPhone(canvasElement, false),
};
export const CampaignSignedInPhone: Story = {
  ...CampaignSignedOutPhone,
  parameters: { signedIn: true },
  play: async ({ canvasElement }) => checkPopulatedPhone(canvasElement, true),
};
export const CampaignSignedOutPhoneDark: Story = {
  ...CampaignSignedOutPhone,
  globals: { ...PHONE, theme: 'dark' },
};
export const CampaignSignedInPhoneDark: Story = {
  ...CampaignSignedInPhone,
  globals: { ...PHONE, theme: 'dark' },
};

/** Every save state the bar shows, longest text included. */
const SAVE_STATES: { saveStatus: SaveStatus; lastSaved: Date | null }[] = [
  { saveStatus: 'saved', lastSaved: new Date() },
  { saveStatus: 'saving', lastSaved: null },
  { saveStatus: 'saved-local', lastSaved: new Date(2026, 0, 1, 22, 58) },
  { saveStatus: 'saved-local-mirror-pending', lastSaved: new Date() },
  { saveStatus: 'error', lastSaved: null },
];

function SaveStatesHarness(props: HarnessProps) {
  const [index, setIndex] = useState(0);
  return (
    <>
      <Harness {...props} {...SAVE_STATES[index]} />
      <Button onClick={() => setIndex(i => (i + 1) % SAVE_STATES.length)}>
        Next save state
      </Button>
    </>
  );
}

/**
 * The switch holds still while the save text changes, so a click that blurs a
 * field and starts a save still lands on it.
 */
export const SwitchHoldsStillWhileSaving: Story = {
  args: { initialEditing: true },
  globals: IPAD_PORTRAIT,
  render: args => <SaveStatesHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('switch', { name: 'Edit sheet' });
    const left = toggle.getBoundingClientRect().left;
    const texts = ['Saving…', 'Saved on this device', 'Saved on this device'];
    for (const text of [...texts, "Couldn't save on this device"]) {
      canvas.getByRole('button', { name: 'Next save state' }).click();
      await new Promise(done =>
        requestAnimationFrame(() => requestAnimationFrame(done))
      );
      await expect(canvas.getAllByText(text).length).toBeGreaterThan(0);
      await expect(toggle.getBoundingClientRect().left).toBeCloseTo(left, 0);
    }
  },
};
