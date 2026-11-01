import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  Mail,
  Save,
  Download,
  Sword,
  Shield,
  Wand2,
  Heart,
} from 'lucide-react';
import {
  SelectField,
  SelectItem,
  SelectSeparator,
  SelectLabel,
  SelectGroup,
} from './select';

/**
 * The Select component is built on Radix UI Select primitive.
 * It supports labels, helper text, error states, icons, and item descriptions.
 */
const meta: Meta<typeof SelectField> = {
  title: 'Forms/Select',
  component: SelectField,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A flexible dropdown select built on Radix UI with full keyboard navigation and accessibility.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
      description: 'Label text displayed above the select',
    },
    helperText: {
      control: 'text',
      description: 'Helper text displayed below the select',
    },
    error: {
      control: 'text',
      description: 'Error message (overrides helperText)',
    },
    required: {
      control: 'boolean',
      description: 'Marks the select as required',
    },
  },
  args: {
    onValueChange: fn(),
  },
  decorators: [
    Story => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  args: {
    label: 'Choose an option',
    children: (
      <>
        <SelectItem value="option1">Option 1</SelectItem>
        <SelectItem value="option2">Option 2</SelectItem>
        <SelectItem value="option3">Option 3</SelectItem>
      </>
    ),
  },
};

// With helper text
export const WithHelperText: Story = {
  args: {
    label: 'Character Class',
    helperText: 'Select your starting class',
    children: (
      <>
        <SelectItem value="fighter">Fighter</SelectItem>
        <SelectItem value="wizard">Wizard</SelectItem>
        <SelectItem value="rogue">Rogue</SelectItem>
        <SelectItem value="cleric">Cleric</SelectItem>
      </>
    ),
  },
};

// Required field
export const Required: Story = {
  args: {
    label: 'Race',
    required: true,
    helperText: 'Required for character creation',
    children: (
      <>
        <SelectItem value="human">Human</SelectItem>
        <SelectItem value="elf">Elf</SelectItem>
        <SelectItem value="dwarf">Dwarf</SelectItem>
        <SelectItem value="halfling">Halfling</SelectItem>
      </>
    ),
  },
};

// Error state
export const ErrorState: Story = {
  args: {
    label: 'Alignment',
    error: 'Please select an alignment',
    children: (
      <>
        <SelectItem value="lg">Lawful Good</SelectItem>
        <SelectItem value="ng">Neutral Good</SelectItem>
        <SelectItem value="cg">Chaotic Good</SelectItem>
      </>
    ),
  },
};

// With icons
export const WithIcons: Story = {
  args: {
    label: 'Action Type',
    children: (
      <>
        <SelectItem value="mail" icon={<Mail className="h-4 w-4" />}>
          Email
        </SelectItem>
        <SelectItem value="save" icon={<Save className="h-4 w-4" />}>
          Save
        </SelectItem>
        <SelectItem value="download" icon={<Download className="h-4 w-4" />}>
          Download
        </SelectItem>
      </>
    ),
  },
};

// With descriptions
export const WithDescriptions: Story = {
  args: {
    label: 'Character Class',
    helperText: 'Each class has unique abilities',
    children: (
      <>
        <SelectItem
          value="fighter"
          icon={<Sword className="h-4 w-4" />}
          description="Master of martial combat"
        >
          Fighter
        </SelectItem>
        <SelectItem
          value="wizard"
          icon={<Wand2 className="h-4 w-4" />}
          description="Wielder of arcane magic"
        >
          Wizard
        </SelectItem>
        <SelectItem
          value="paladin"
          icon={<Shield className="h-4 w-4" />}
          description="Holy warrior of justice"
        >
          Paladin
        </SelectItem>
        <SelectItem
          value="cleric"
          icon={<Heart className="h-4 w-4" />}
          description="Divine spellcaster and healer"
        >
          Cleric
        </SelectItem>
      </>
    ),
  },
};

// With groups and separators
export const WithGroups: Story = {
  render: () => (
    <SelectField label="Spell School" helperText="Choose a school of magic">
      <SelectGroup>
        <SelectLabel>Offensive</SelectLabel>
        <SelectItem value="evocation">Evocation</SelectItem>
        <SelectItem value="necromancy">Necromancy</SelectItem>
      </SelectGroup>
      <SelectSeparator />
      <SelectGroup>
        <SelectLabel>Utility</SelectLabel>
        <SelectItem value="divination">Divination</SelectItem>
        <SelectItem value="transmutation">Transmutation</SelectItem>
        <SelectItem value="illusion">Illusion</SelectItem>
      </SelectGroup>
      <SelectSeparator />
      <SelectGroup>
        <SelectLabel>Support</SelectLabel>
        <SelectItem value="abjuration">Abjuration</SelectItem>
        <SelectItem value="enchantment">Enchantment</SelectItem>
        <SelectItem value="conjuration">Conjuration</SelectItem>
      </SelectGroup>
    </SelectField>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Options can be organized into groups with labels and separators.',
      },
    },
  },
};

// Different sizes
export const Sizes: Story = {
  render: () => (
    <div className="space-y-4">
      <SelectField label="Small" triggerProps={{ size: 'sm' }}>
        <SelectItem value="1">Option 1</SelectItem>
        <SelectItem value="2">Option 2</SelectItem>
      </SelectField>
      <SelectField label="Medium (default)" triggerProps={{ size: 'md' }}>
        <SelectItem value="1">Option 1</SelectItem>
        <SelectItem value="2">Option 2</SelectItem>
      </SelectField>
      <SelectField label="Large" triggerProps={{ size: 'lg' }}>
        <SelectItem value="1">Option 1</SelectItem>
        <SelectItem value="2">Option 2</SelectItem>
      </SelectField>
    </div>
  ),
};

// Controlled with default value
export const WithDefaultValue: Story = {
  args: {
    label: 'Favorite Race',
    defaultValue: 'elf',
    children: (
      <>
        <SelectItem value="human">Human</SelectItem>
        <SelectItem value="elf">Elf</SelectItem>
        <SelectItem value="dwarf">Dwarf</SelectItem>
        <SelectItem value="halfling">Halfling</SelectItem>
      </>
    ),
  },
};

// Disabled items
export const WithDisabledItems: Story = {
  args: {
    label: 'Available Classes',
    helperText: 'Some classes are locked',
    children: (
      <>
        <SelectItem value="fighter">Fighter</SelectItem>
        <SelectItem value="wizard">Wizard</SelectItem>
        <SelectItem value="rogue">Rogue</SelectItem>
        <SelectItem value="artificer" disabled>
          Artificer (Coming Soon)
        </SelectItem>
        <SelectItem value="blood-hunter" disabled>
          Blood Hunter (Coming Soon)
        </SelectItem>
      </>
    ),
  },
};

function SelectStates() {
  return (
    <div className="space-y-4">
      <SelectField
        label="Class"
        defaultValue="fighter"
        helperText="Sets your hit die"
        triggerProps={{ 'aria-label': 'Class' }}
      >
        <SelectItem value="fighter">Fighter</SelectItem>
        <SelectItem value="wizard">Wizard</SelectItem>
      </SelectField>
      <SelectField
        label="Alignment"
        error="Pick an alignment"
        triggerProps={{ 'aria-label': 'Alignment' }}
      >
        <SelectItem value="lg">Lawful good</SelectItem>
      </SelectField>
      <SelectField
        label="Background"
        defaultValue="sage"
        disabled
        triggerProps={{ 'aria-label': 'Background' }}
      >
        <SelectItem value="sage">Sage</SelectItem>
      </SelectField>
    </div>
  );
}

export const States: Story = {
  render: () => <SelectStates />,
  parameters: { a11y: { test: 'error' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alignment = canvas.getByRole('combobox', { name: 'Alignment' });
    await expect(alignment).toHaveAttribute('aria-invalid', 'true');
    await expect(alignment).toHaveAccessibleDescription('Pick an alignment');
    await expect(getComputedStyle(alignment).borderTopLeftRadius).toBe('4px');
  },
};

export const StatesDark: Story = {
  render: () => <SelectStates />,
  parameters: { a11y: { test: 'error' } },
  globals: { theme: 'dark' },
};

// Computed colours per theme: the menu surface, the brass outline (ring)
// and the brass check mark.
const MENU_COLOURS = {
  paper: {
    elevated: 'rgb(251, 251, 248)',
    ring: 'rgb(160, 123, 44)',
    check: 'rgb(122, 91, 23)',
  },
  felt: {
    elevated: 'rgb(31, 43, 37)',
    ring: 'rgb(200, 161, 75)',
    check: 'rgb(200, 161, 75)',
  },
};

function SizeSelect() {
  return (
    <SelectField label="Size" defaultValue="medium">
      <SelectItem value="small">Small</SelectItem>
      <SelectItem value="medium">Medium</SelectItem>
      <SelectItem value="large">Large</SelectItem>
    </SelectField>
  );
}

async function checkMenu(
  canvasElement: HTMLElement,
  theme: keyof typeof MENU_COLOURS
) {
  const colours = MENU_COLOURS[theme];
  const canvas = within(canvasElement);
  const page = within(canvasElement.ownerDocument.body);
  const trigger = canvas.getByRole('combobox', { name: 'Size' });

  trigger.focus();
  await userEvent.keyboard('{Enter}');
  const menu = await page.findByRole('listbox');
  const style = getComputedStyle(menu);
  await expect(style.borderTopLeftRadius).toBe('6px');
  await expect(style.borderTopWidth).toBe('1px');
  await expect(style.boxShadow).not.toBe('none');
  await waitFor(() =>
    expect(getComputedStyle(menu).backgroundColor).toBe(colours.elevated)
  );

  const chosen = page.getByRole('option', { name: 'Medium' });
  await expect(getComputedStyle(chosen.querySelector('svg')!).color).toBe(
    colours.check
  );

  // The keyboard highlight is a 2px brass outline inside the row.
  await userEvent.keyboard('{ArrowDown}');
  const large = page.getByRole('option', { name: 'Large' });
  await waitFor(() => expect(large).toHaveAttribute('data-highlighted'));
  await waitFor(() => {
    const outline = getComputedStyle(large);
    expect(outline.outlineStyle).toBe('solid');
    expect(outline.outlineWidth).toBe('2px');
    expect(outline.outlineOffset).toBe('-2px');
    expect(outline.outlineColor).toBe(colours.ring);
  });
  await expect(getComputedStyle(chosen).outlineStyle).toBe('none');

  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(page.queryByRole('listbox')).toBeNull());
  await expect(trigger).toHaveTextContent('Large');
  await expect(trigger).toHaveFocus();
}

export const Menu: Story = {
  render: () => <SizeSelect />,
  parameters: { a11y: { test: 'error' } },
  play: ({ canvasElement }) => checkMenu(canvasElement, 'paper'),
};

export const MenuDark: Story = {
  render: () => <SizeSelect />,
  parameters: { a11y: { test: 'error' } },
  globals: { theme: 'dark' },
  play: ({ canvasElement }) => checkMenu(canvasElement, 'felt'),
};
