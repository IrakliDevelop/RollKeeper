import { useState } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnchoredEditor } from '../index';

/** A fake visual viewport the test can shrink, like an on-screen keyboard. */
class FakeViewport extends EventTarget {
  height = 800;
  offsetTop = 0;
}

let viewport: FakeViewport;

/** A (min-width: 640px) query the test can flip, like a split-view resize. */
let wideMatches = true;
let mediaListeners: Array<() => void> = [];

function setWide(wide: boolean) {
  wideMatches = wide;
  for (const listener of mediaListeners) listener();
}

function stubMatchMedia() {
  mediaListeners = [];
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      get matches() {
        return wideMatches;
      },
      media: query,
      addEventListener: (_: string, listener: () => void) => {
        mediaListeners.push(listener);
      },
      removeEventListener: (_: string, listener: () => void) => {
        mediaListeners = mediaListeners.filter(l => l !== listener);
      },
    }))
  );
}

beforeEach(() => {
  // Radix positions popovers with ResizeObserver.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  viewport = new FakeViewport();
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 800);
  wideMatches = true;
  stubMatchMedia();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness({
  editing = true,
  onSave,
}: {
  editing?: boolean;
  onSave?: (value: number) => void;
}) {
  const [score, setScore] = useState(15);
  return (
    <AnchoredEditor
      label="Strength"
      value={score}
      min={1}
      max={30}
      editing={editing}
      onSave={next => {
        setScore(next);
        onSave?.(next);
      }}
      context={draft => (
        <p>
          Modifier {draft === undefined ? '—' : Math.floor((draft - 10) / 2)}
        </p>
      )}
    >
      <button type="button">STR {score}</button>
    </AnchoredEditor>
  );
}

const trigger = () => screen.getByRole('button', { name: /^STR/ });
const field = () => screen.getByRole('textbox', { name: 'Strength' });

async function openEditor() {
  const user = userEvent.setup();
  await user.click(trigger());
  await waitFor(() => expect(field()).toHaveFocus());
  return user;
}

describe('AnchoredEditor', () => {
  it('leaves the trigger alone in play mode', async () => {
    const user = userEvent.setup();
    render(<Harness editing={false} />);

    expect(trigger().className).not.toMatch(/outline-dashed/);
    await user.click(trigger());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('marks the trigger with the dashed edit cue in edit mode', () => {
    render(<Harness />);

    expect(trigger()).toHaveClass(
      'outline-1',
      'outline-dashed',
      'outline-input-border'
    );
  });

  it('opens a popover from 640px with the field focused', async () => {
    render(<Harness />);
    await openEditor();

    const editor = screen.getByRole('dialog', { name: 'Strength' });
    expect(editor).toHaveAttribute('data-anchored-editor', 'popover');
    expect(field()).toHaveValue('15');
    expect(field()).toHaveAttribute('inputmode', 'numeric');
    expect(field()).toHaveClass('type-num-md');
  });

  it('steps with the buttons, stopping at the bounds', async () => {
    render(<Harness />);
    const user = await openEditor();

    await user.click(screen.getByRole('button', { name: 'Increase Strength' }));
    expect(field()).toHaveValue('16');
    await user.clear(field());
    await user.type(field(), '1');
    expect(
      screen.getByRole('button', { name: 'Decrease Strength' })
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('keeps focus on a stepper that reaches its bound', async () => {
    render(<Harness />);
    const user = await openEditor();
    await user.clear(field());
    await user.type(field(), '29');
    const increase = screen.getByRole('button', { name: 'Increase Strength' });

    await user.click(increase);
    await user.click(increase);

    expect(field()).toHaveValue('30');
    expect(increase).toHaveAttribute('aria-disabled', 'true');
    expect(increase).toHaveFocus();
  });

  it('saves on Enter, clamped, and gives focus back to the trigger', async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    const user = await openEditor();

    await user.clear(field());
    await user.type(field(), '45{Enter}');

    expect(onSave).toHaveBeenCalledExactlyOnceWith(30);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger()).toHaveFocus());
    expect(trigger()).toHaveTextContent('STR 30');
  });

  it('saves from the Save button', async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    const user = await openEditor();

    await user.click(screen.getByRole('button', { name: 'Increase Strength' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledExactlyOnceWith(16);
  });

  it('discards the draft on Escape and on Cancel', async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    let user = await openEditor();

    await user.type(field(), '9');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger()).toHaveFocus());

    user = await openEditor();
    expect(field()).toHaveValue('15');
    await user.click(screen.getByRole('button', { name: 'Increase Strength' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(trigger()).toHaveFocus());

    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps the old value when saved empty', async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    const user = await openEditor();

    await user.clear(field());
    expect(screen.getByRole('status')).toHaveTextContent('Enter a number.');
    await user.keyboard('{Enter}');

    expect(onSave).not.toHaveBeenCalled();
    expect(trigger()).toHaveTextContent('STR 15');
  });

  it('shows the range while the draft is out of it', async () => {
    render(<Harness />);
    const user = await openEditor();

    await user.clear(field());
    await user.type(field(), '31');

    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(field()).toHaveAccessibleDescription('Enter a number from 1 to 30.');
  });

  it('leaves an out-of-range draft alone when a dimmed stepper is pressed', async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    const user = await openEditor();

    await user.clear(field());
    await user.type(field(), '45');
    const increase = screen.getByRole('button', { name: 'Increase Strength' });
    expect(increase).toHaveAttribute('aria-disabled', 'true');
    await user.click(increase);

    expect(field()).toHaveValue('45');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('passes the draft to the context', async () => {
    render(<Harness />);
    const user = await openEditor();
    expect(screen.getByText('Modifier 2')).toBeInTheDocument();

    await user.clear(field());
    await user.type(field(), '20');
    expect(screen.getByText('Modifier 5')).toBeInTheDocument();
  });

  it('steps with the arrow keys, by 10 with Shift', async () => {
    render(<Harness />);
    const user = await openEditor();

    await user.keyboard('{ArrowUp}{Shift>}{ArrowDown}{/Shift}');
    expect(field()).toHaveValue('6');
  });

  it('drops the draft on a tap outside', async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    await openEditor();
    // The modal popover turns off pointer events outside it.
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    await user.type(field(), '9');
    await user.click(document.body);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onSave).not.toHaveBeenCalled();
    expect(trigger()).toHaveTextContent('STR 15');
    await openEditor();
    expect(field()).toHaveValue('15');
  });

  it('closes when edit mode ends and stays closed when it starts again', async () => {
    const view = render(<Harness />);
    await openEditor();

    view.rerender(<Harness editing={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<Harness />);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger()).toHaveClass('outline-dashed');
  });

  it('keeps the draft when the window crosses 640px', async () => {
    render(<Harness />);
    const user = await openEditor();
    await user.click(screen.getByRole('button', { name: 'Increase Strength' }));

    act(() => setWide(false));

    const sheet = await screen.findByRole('dialog', { name: 'Strength' });
    expect(sheet).toHaveAttribute('data-anchored-editor', 'sheet');
    expect(field()).toHaveValue('16');
  });

  it('keeps the field in view when the keyboard opens over the popover', async () => {
    // jsdom has no scrollIntoView; iPads are 640px or wider, so they get the
    // popover.
    const proto = HTMLElement.prototype as Partial<HTMLElement>;
    proto.scrollIntoView = () => {};
    const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
    try {
      render(<Harness />);
      await openEditor();
      expect(screen.getByRole('dialog', { name: 'Strength' })).toHaveAttribute(
        'data-anchored-editor',
        'popover'
      );
      expect(scrollIntoView).not.toHaveBeenCalled();

      act(() => {
        viewport.height = 500;
        viewport.dispatchEvent(new Event('resize'));
      });

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    } finally {
      scrollIntoView.mockRestore();
      delete proto.scrollIntoView;
    }
  });

  describe('narrower than 640px', () => {
    beforeEach(() => {
      wideMatches = false;
    });

    it('opens a bottom sheet titled by the label', async () => {
      render(<Harness />);
      await openEditor();

      const sheet = screen.getByRole('dialog', { name: 'Strength' });
      expect(sheet).toHaveAttribute('data-anchored-editor', 'sheet');
      expect(sheet).toHaveClass(
        'bottom-0',
        'pb-[max(1rem,env(safe-area-inset-bottom))]'
      );
    });

    it('rises above the on-screen keyboard', async () => {
      render(<Harness />);
      await openEditor();
      const sheet = screen.getByRole('dialog', { name: 'Strength' });
      expect(sheet.style.bottom).toBe('0px');

      act(() => {
        viewport.height = 500;
        viewport.dispatchEvent(new Event('resize'));
      });

      expect(sheet.style.bottom).toBe('300px');
    });

    it('gives focus back to the trigger on Escape', async () => {
      render(<Harness />);
      const user = await openEditor();

      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() => expect(trigger()).toHaveFocus());
    });
  });
});
