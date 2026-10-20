import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import BookmarkTabs, { type BookmarkTabItem } from './BookmarkTabs';

const TABS: BookmarkTabItem[] = [
  { id: 'actions', label: 'Actions', content: <p>Attacks</p> },
  { id: 'stats', label: 'Stats', content: <p>Abilities</p>, disabled: true },
  { id: 'combat', label: 'Combat', content: <p>Hit points</p> },
  { id: 'map', label: 'Map', content: <p>Battle map</p>, hidden: true },
  { id: 'spells', label: 'Spells', content: <p>Spell slots</p> },
];

function renderTabs(persistKey?: string) {
  render(<BookmarkTabs tabs={TABS} persistKey={persistKey} />);
  return (name: string) => screen.getByRole('tab', { name });
}

describe('BookmarkTabs', () => {
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('draws text tabs on a divider rule with a brass underline on the active tab', () => {
    const tab = renderTabs();

    expect(screen.getByRole('tablist')).toHaveClass(
      'border-b',
      'border-divider'
    );
    expect(tab('Actions')).toHaveClass(
      'border-b-2',
      'border-brass-fill',
      'text-heading'
    );
    expect(tab('Combat')).toHaveClass('border-transparent', 'text-muted');
    for (const name of ['Actions', 'Combat']) {
      expect(tab(name).className).not.toMatch(/rounded|shadow|blue|bg-surface/);
    }
  });

  it('puts the panel on the page canvas with no box', () => {
    renderTabs();

    const panel = screen.getByRole('tabpanel');
    const wrapper = panel.parentElement!;
    expect(wrapper).toHaveClass('py-4', 'sm:py-6');
    for (const element of [wrapper, wrapper.parentElement!]) {
      expect(element.className).not.toMatch(
        /border|shadow|rounded|bg-surface|p-4|px-/
      );
    }
  });

  it('moves and opens with the arrow keys, wrapping and skipping disabled and hidden tabs', () => {
    const tab = renderTabs();
    tab('Actions').focus();

    fireEvent.keyDown(tab('Actions'), { key: 'ArrowRight' });
    expect(tab('Combat')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Combat')).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Hit points');

    fireEvent.keyDown(tab('Combat'), { key: 'ArrowRight' });
    expect(tab('Spells')).toHaveFocus();
    expect(screen.queryByRole('tab', { name: 'Map' })).toBeNull();

    fireEvent.keyDown(tab('Spells'), { key: 'ArrowLeft' });
    expect(tab('Combat')).toHaveFocus();
    fireEvent.keyDown(tab('Combat'), { key: 'ArrowLeft' });
    expect(tab('Actions')).toHaveFocus();

    fireEvent.keyDown(tab('Actions'), { key: 'ArrowLeft' });
    expect(tab('Spells')).toHaveFocus();
    expect(tab('Spells')).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(tab('Spells'), { key: 'ArrowRight' });
    expect(tab('Actions')).toHaveFocus();
  });

  it('jumps to the first and last enabled tab with Home and End', () => {
    const tab = renderTabs();
    tab('Actions').focus();

    fireEvent.keyDown(tab('Actions'), { key: 'End' });
    expect(tab('Spells')).toHaveFocus();
    fireEvent.keyDown(tab('Spells'), { key: 'Home' });
    expect(tab('Actions')).toHaveFocus();
  });

  it('keeps one tab in the tab order and ignores other keys', () => {
    const tab = renderTabs();

    expect(tab('Actions')).toHaveAttribute('tabindex', '0');
    expect(tab('Combat')).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(tab('Actions'), { key: 'ArrowDown' });
    expect(tab('Actions')).toHaveAttribute('aria-selected', 'true');
  });

  it('leaves modified arrow keys to the browser', () => {
    const tab = renderTabs();

    for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) {
      const allowed = fireEvent.keyDown(tab('Actions'), {
        key: 'ArrowRight',
        [modifier]: true,
      });
      expect(allowed).toBe(true);
      expect(tab('Actions')).toHaveAttribute('aria-selected', 'true');
    }
  });

  it('keeps a focused tab clear of the scroll chevrons', () => {
    renderTabs();

    expect(screen.getByRole('tablist')).toHaveClass(
      'scroll-px-8',
      'pointer-coarse:scroll-px-11'
    );
  });

  it('remembers a tab chosen from the keyboard under the same storage key', () => {
    const tab = renderTabs('tabbed-layout-active-tab');

    fireEvent.keyDown(tab('Actions'), { key: 'ArrowRight' });
    expect(localStorage.getItem('bookmark-tabs-tabbed-layout-active-tab')).toBe(
      'combat'
    );
    expect(tab('Combat')).toHaveAttribute('id', 'tab-combat');
  });

  it('makes tabs and scroll chevrons 44px on coarse pointers, without blur', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    const tab = renderTabs();

    expect(tab('Actions')).toHaveClass('pointer-coarse:min-h-11');
    const chevron = screen.getByRole('button', { name: 'Scroll tabs right' });
    expect(chevron).toHaveClass('pointer-coarse:w-11', 'bg-surface');
    expect(chevron.className).not.toMatch(/backdrop-blur|\/90/);
  });
});
