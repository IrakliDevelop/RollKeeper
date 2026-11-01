import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '@/components/ui/forms/button';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import { SpeedEditor } from './SpeedEditor';
const meta = {
  title: 'Character/SpeedEditor',
  component: SpeedEditor,
  args: {
    character: makeCharacter(),
    trigger: <Button>Edit speeds</Button>,
    onSave: fn(),
  },
  parameters: {
    viewport: {
      options: {
        keyboard: {
          name: 'iPad landscape with keyboard space',
          styles: { width: '1180px', height: '360px' },
        },
      },
    },
  },
  globals: { viewport: { value: 'keyboard', isRotated: false } },
  beforeEach: () => emulateCoarsePointer(),
} satisfies Meta<typeof SpeedEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
export const KeyboardSpace: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', {
      name: 'Edit speeds',
    });
    await userEvent.click(trigger);
    const dialog = await within(document.body).findByRole('dialog');
    await waitFor(() =>
      expect(dialog.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        window.innerHeight
      )
    );
    await expect(dialog.scrollHeight).toBeGreaterThan(dialog.clientHeight);
    const swim = within(dialog).getByRole('textbox', { name: 'Swim' });
    swim.focus();
    swim.scrollIntoView({ block: 'nearest' });
    await expect(swim).toHaveFocus();
    const save = within(dialog).getByRole('button', { name: 'Save' });
    save.focus();
    save.scrollIntoView({ block: 'nearest' });
    await expect(save.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      dialog.getBoundingClientRect().bottom
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
export const KeyboardSpaceDark: Story = {
  ...KeyboardSpace,
  globals: { ...meta.globals, theme: 'dark' },
};
