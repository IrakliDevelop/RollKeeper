import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fireEvent, waitFor, within } from 'storybook/test';
import { EquipmentReorderControls } from '@/components/ui/character/equipment/EquipmentReorderControls';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import DragDropList from './DragDropList';

const NAMES = ['Longsword', 'Shortbow', 'Dagger'];

function moveItem(list: string[], from: number, to: number) {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function ReorderHarness({ withControls = false }: { withControls?: boolean }) {
  const [names, setNames] = useState(NAMES);
  const move = (from: number, to: number) =>
    setNames(current => moveItem(current, from, to));

  return (
    <div className="w-80">
      <DragDropList
        as="ul"
        itemAs="li"
        className="flex flex-col gap-2"
        items={names}
        keyExtractor={name => name}
        onReorder={move}
        renderItem={(name, index) => (
          <>
            <div
              data-name
              className="border-divider type-ui text-body rounded-sm border p-3 pl-8"
            >
              {name}
            </div>
            {withControls ? (
              <EquipmentReorderControls
                name={name}
                index={index}
                count={names.length}
                onMove={to => move(index, to)}
              />
            ) : null}
          </>
        )}
      />
    </div>
  );
}

/**
 * Reorder rows by dragging. The dragged row dims, the row under the pointer
 * gets a brass outline (no layout shift), and the grip stays muted.
 */
const meta: Meta<typeof DragDropList> = {
  title: 'Layout/DragDropList',
  component: DragDropList,
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const readNames = (canvasElement: HTMLElement) =>
  within(canvasElement)
    .getAllByRole('listitem')
    .map(row => row.querySelector('[data-name]')?.textContent);

/** Stubs `(hover: hover)` to `value`; returns a restore function. */
function stubHover(value: boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => {
    const result = original.call(window, query);
    if (query !== '(hover: hover)') return result;
    return {
      matches: value,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList;
  }) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

export const Default: Story = {
  render: () => <ReorderHarness />,
  beforeEach: () => {
    if (window.matchMedia('(hover: hover)').matches) return;
    return stubHover(true);
  },
  play: async ({ canvasElement }) => {
    const rows = within(canvasElement).getAllByRole('listitem');
    await expect(rows[0].querySelector('svg')).not.toBeNull();

    const dt = new DataTransfer();
    fireEvent.dragStart(rows[0], { dataTransfer: dt });
    await waitFor(() => expect(getComputedStyle(rows[0]).opacity).toBe('0.5'));

    const height = rows[2].getBoundingClientRect().height;
    fireEvent.dragOver(rows[2], { dataTransfer: dt });
    await waitFor(() => {
      const style = getComputedStyle(rows[2]);
      expect(style.outlineStyle).toBe('solid');
      expect(style.outlineWidth).toBe('2px');
    });
    await expect(rows[2].getBoundingClientRect().height).toBe(height);

    fireEvent.drop(rows[2], { dataTransfer: dt });
    await waitFor(() =>
      expect(readNames(canvasElement)).toEqual([
        'Shortbow',
        'Dagger',
        'Longsword',
      ])
    );
  },
};

export const Dark: Story = {
  render: () => <ReorderHarness />,
  globals: { theme: 'dark' },
};

/** Without a hover pointer the grip and dragging go away; buttons reorder. */
export const Touch: Story = {
  render: () => <ReorderHarness withControls />,
  parameters: {
    viewport: {
      options: {
        phone: {
          name: 'Phone',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
      },
    },
  },
  globals: { viewport: { value: 'phone', isRotated: false } },
  beforeEach: () => stubHover(false),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const row of canvas.getAllByRole('listitem')) {
      await expect(row).toHaveAttribute('draggable', 'false');
    }
    await expect(canvasElement.querySelector('svg')).toBeNull();

    const [moveDown] = canvas.getAllByRole('button', { name: 'Move down' });
    fireEvent.click(moveDown);
    await waitFor(() =>
      expect(readNames(canvasElement)).toEqual([
        'Shortbow',
        'Longsword',
        'Dagger',
      ])
    );

    const restore = emulateCoarsePointer();
    try {
      for (const button of canvas.getAllByRole('button', {
        name: /^Move (up|down)$/,
      })) {
        await expect(
          button.getBoundingClientRect().height
        ).toBeGreaterThanOrEqual(44);
      }
    } finally {
      restore();
    }
  },
};
