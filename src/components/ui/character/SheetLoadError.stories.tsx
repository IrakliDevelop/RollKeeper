import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { SheetLoadError } from './SheetLoadError';
const meta = {
  title: 'Character/SheetLoadError',
  component: SheetLoadError,
  args: { thing: 'Hit points' },
} satisfies Meta<typeof SheetLoadError>;
export default meta;
type Story = StoryObj<typeof meta>;
function Broken(): never {
  throw new Error('Synthetic section failure');
}
export const FailedSection: Story = {
  render: args => (
    <ErrorBoundary fallback={<SheetLoadError {...args} />}>
      <Broken />
    </ErrorBoundary>
  ),
};
