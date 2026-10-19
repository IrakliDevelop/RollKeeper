import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from '../forms/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';

/**
 * Felt and Brass cards hold one discrete object: a character, monster,
 * spell, item or campaign. They sit on surface-raised with a 1px divider and
 * a 6px radius, and never nest or cast a shadow.
 */
const meta: Meta<typeof Card> = {
  title: 'Layout/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
    docs: {
      description: {
        component:
          'Use Card for a discrete object and Section for layout. bordered is a deprecated alias of default. An interactive card (interactive or onClick) is a button: it shows an input-border edge on hover and opens with Enter or Space.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

function MonsterCard() {
  return (
    <Card className="w-72">
      <CardHeader>
        <CardTitle>Goblin</CardTitle>
        <CardDescription>Small humanoid, neutral evil</CardDescription>
      </CardHeader>
      <CardContent className="text-body mt-3 text-sm">
        AC 15, HP 7, speed 30 ft.
      </CardContent>
      <CardFooter className="mt-4 gap-2">
        <Button size="sm">Add to encounter</Button>
      </CardFooter>
    </Card>
  );
}

export const Default: Story = {
  render: () => <MonsterCard />,
};

export const DefaultDark: Story = {
  render: () => <MonsterCard />,
  globals: { theme: 'dark' },
};

const openSpell = fn();

function SpellCard() {
  return (
    <Card className="w-72" onClick={openSpell}>
      <CardTitle>Fireball</CardTitle>
      <CardDescription className="mt-1">3rd-level evocation</CardDescription>
    </Card>
  );
}

export const Interactive: Story = {
  render: () => <SpellCard />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    openSpell.mockClear();
    const card = canvas.getByRole('button', { name: /Fireball/ });
    await expect(card).toHaveClass('hover:border-input-border');
    card.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await expect(openSpell).toHaveBeenCalledTimes(2);
  },
};

export const InteractiveDark: Story = {
  render: () => <SpellCard />,
  globals: { theme: 'dark' },
};
