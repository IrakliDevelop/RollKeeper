import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ConditionIconPicker } from './ConditionIconPicker';
import type { ConditionIconName } from '@/utils/conditionIconRegistry';

function PickerDemo({ initial }: { initial: ConditionIconName }) {
  const [icon, setIcon] = useState<ConditionIconName>(initial);
  return (
    <div className="bg-surface text-body flex items-center gap-3 p-8">
      <ConditionIconPicker value={icon} onChange={setIcon} />
      <span className="text-muted text-sm">Selected: {icon}</span>
    </div>
  );
}

const meta: Meta<typeof PickerDemo> = {
  title: 'Forms/ConditionIconPicker',
  component: PickerDemo,
  parameters: { layout: 'centered' },
  args: { initial: 'skull' },
};

export default meta;
type Story = StoryObj<typeof PickerDemo>;

export const Light: Story = {};

export const Dark: Story = {
  globals: { theme: 'dark' },
};
