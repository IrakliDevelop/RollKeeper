import { createRef } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TabbedCharacterSheet from '../TabbedCharacterSheet';
import type { TabbedCharacterSheetRef } from '../TabbedCharacterSheet';
import type { TabbedSheetConfigParams } from '../tabbedSheetConfig';

// The real config needs the whole sheet's handler bag; these tests only pin
// how TabbedCharacterSheet wires BookmarkTabs, so two plain tabs are enough.
vi.mock('../tabbedSheetConfig', () => ({
  createTabbedSheetConfig: () => [
    { id: 'actions', label: 'Actions', content: <div>Actions panel</div> },
    { id: 'combat', label: 'Combat', content: <div>Combat panel</div> },
  ],
}));

const BAR_OFFSET = 'scroll-mt-[calc(var(--app-header-height,4rem)+1rem)]';

beforeEach(() => {
  // The tab strip watches its own width for the scroll chevrons.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TabbedCharacterSheet tab jumps', () => {
  it('scrolls the tabs into view clear of the sticky bar', () => {
    vi.useFakeTimers();
    const scrolled: Element[] = [];
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (
      this: Element
    ) {
      scrolled.push(this);
    });
    const ref = createRef<TabbedCharacterSheetRef>();
    render(
      <TabbedCharacterSheet ref={ref} {...({} as TabbedSheetConfigParams)} />
    );

    act(() => {
      ref.current?.switchToTab('conditions');
      vi.advanceTimersByTime(200);
    });

    expect(ref.current?.getCurrentTab()).toBe('combat');
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]).toHaveClass(BAR_OFFSET);
  });
});
