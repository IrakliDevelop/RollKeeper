import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Plus } from 'lucide-react';
import { Button } from '../forms/button';
import { Section } from './section';

/**
 * A Felt and Brass section: a Vollkorn heading on a 1px divider rule, then
 * the content, with no box. It replaces cards used as layout.
 */
const meta: Meta<typeof Section> = {
  title: 'Layout/Section',
  component: Section,
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
    docs: {
      description: {
        component:
          'level picks h2 (default), h3 or h4 and the matching type step. trailing holds controls at the end of the heading row.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

function Sections() {
  return (
    <div className="max-w-xl space-y-8">
      <Section
        heading="Hit dice"
        trailing={
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
            Add
          </Button>
        }
      >
        <p className="type-body text-body">3 of 5 d10 left.</p>
      </Section>
      <Section heading="Saving throws" level={3}>
        <p className="type-body text-body">Strength and Constitution.</p>
      </Section>
      <Section heading="Languages" level={4}>
        <p className="type-body text-body">Common, Dwarvish.</p>
      </Section>
    </div>
  );
}

export const Levels: Story = {
  render: () => <Sections />,
};

export const LevelsDark: Story = {
  render: () => <Sections />,
  globals: { theme: 'dark' },
};
