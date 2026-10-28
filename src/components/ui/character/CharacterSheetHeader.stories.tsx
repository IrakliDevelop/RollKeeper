import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect } from 'react';
import { expect, fn, within } from 'storybook/test';
import { remountOnTheme } from '@/components/ui/foundations/remountOnTheme';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import CharacterSheetHeader from './CharacterSheetHeader';
import { SheetModeProvider, useSheetModeState } from './SheetMode';

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
}

function Harness({ initialEditing }: HarnessProps) {
  const mode = useSheetModeState('story-character');
  const { setEditing } = mode;
  useEffect(() => {
    if (initialEditing) setEditing(true);
  }, [initialEditing, setEditing]);

  return (
    <SheetModeProvider value={mode}>
      <CharacterSheetHeader
        characterId="story-character"
        characterName="Brin Ironfoot"
        characterRace="Dwarf"
        characterClass="Fighter"
        characterLevel={3}
        characterAlignment="Lawful Good"
        characterCreatureType="Humanoid"
        saveStatus="saved"
        lastSaved={null}
        hasUnsavedChanges={false}
        onManualSave={fn()}
        onExport={fn()}
        onShowResetModal={fn()}
        onUpdateName={fn()}
        onAddToast={fn()}
      />
    </SheetModeProvider>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Character/CharacterSheetHeader',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    a11y: {
      test: 'error',
      // The sticky bar and the character card are both <header>s, so the
      // page has two banner landmarks. That predates the sheet modes and is
      // out of scope here.
      config: {
        rules: [
          { id: 'landmark-no-duplicate-banner', enabled: false },
          { id: 'landmark-unique', enabled: false },
        ],
      },
    },
    viewport: { options: VIEWPORTS },
  },
  globals: IPAD_LANDSCAPE,
  args: { initialEditing: false },
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
  // One row, nothing pushed off-screen. Only the bar's own edges: the card
  // under it overflows at 390px already (pre-existing, out of scope here).
  await expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth);
  await expect(bar.getBoundingClientRect().right).toBeLessThanOrEqual(
    window.innerWidth + 0.5
  );
}

/** iPad widths show the switch label; the phone hides it visually (E1). */
async function checkLabelShown(canvasElement: HTMLElement) {
  const label = within(canvasElement).getByText('Edit sheet');
  await expect(label.getBoundingClientRect().width).toBeGreaterThan(1);
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
      .getByRole('link', { name: 'Back to Characters' })
      .getBoundingClientRect();
    const overlaps =
      Math.round(back.left) < Math.round(area.right) &&
      Math.round(area.left) < Math.round(back.right) &&
      Math.round(back.top) < Math.round(area.bottom) &&
      Math.round(area.top) < Math.round(back.bottom);
    await expect(overlaps).toBe(false);
  },
};
