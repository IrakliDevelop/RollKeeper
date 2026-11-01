import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Section } from '@/components/ui/layout/section';
import { ThemeChooser } from './ThemeChooser';
import type { Theme } from '@/types/theme';

function Appearance({ character = false }: { character?: boolean }) {
  const [theme, setTheme] = useState<Theme | undefined>(
    character ? undefined : 'dark'
  );
  return (
    <main
      data-theme={theme === 'system' || theme === undefined ? 'light' : theme}
      className="bg-surface text-body min-h-screen px-4 py-6 sm:px-6"
    >
      <div className="mx-auto max-w-3xl">
        <Section heading={character ? 'Appearance' : 'App appearance'}>
          <ThemeChooser
            character={character}
            value={theme}
            onChange={setTheme}
          />
        </Section>
      </div>
    </main>
  );
}
const meta: Meta<typeof Appearance> = {
  title: 'Character/Appearance settings',
  component: Appearance,
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error' },
    viewport: {
      options: {
        phone: {
          name: 'Phone',
          styles: { width: '320px', height: '800px' },
          type: 'mobile',
        },
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    for (const name of ['Light', 'Dark', 'Blue dark', 'Use system theme']) {
      await userEvent.click(canvas.getByRole('radio', { name }));
      await expect(canvas.getByRole('radio', { name })).toBeChecked();
    }
    if (args.character) {
      await userEvent.click(
        canvas.getByRole('radio', { name: 'Use app theme' })
      );
      await expect(
        canvas.getByRole('radio', { name: 'Use app theme' })
      ).toBeChecked();
    }
    const doc = canvasElement.ownerDocument.documentElement;
    await expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth);
  },
};
export default meta;
type Story = StoryObj<typeof meta>;
export const App: Story = {};
export const Character: Story = { args: { character: true } };
export const Phone: Story = {
  args: { character: true },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
