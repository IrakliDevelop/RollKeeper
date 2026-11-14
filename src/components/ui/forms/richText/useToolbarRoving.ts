import {
  useCallback,
  useLayoutEffect,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';

function enabledButtons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll('button')).filter(
    button => !button.disabled
  );
}

/**
 * Roving tabindex for a `role="toolbar"`: one tab stop, ←/→ move and wrap,
 * Home/End jump, disabled buttons are skipped. When the remembered button
 * disappears or disables, the tab stop goes back to the first enabled one.
 */
export function useToolbarRoving<T extends HTMLElement>(): {
  ref: RefObject<T | null>;
  onKeyDown: (e: KeyboardEvent<T>) => void;
  onFocus: (e: FocusEvent<T>) => void;
} {
  const ref = useRef<T | null>(null);
  const remembered = useRef<HTMLButtonElement | null>(null);

  // No deps: tools mount, unmount, enable and disable on every transaction.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const current = remembered.current;
    const stop =
      current && root.contains(current) && !current.disabled
        ? current
        : (enabledButtons(root)[0] ?? null);
    for (const button of Array.from(root.querySelectorAll('button'))) {
      button.tabIndex = button === stop ? 0 : -1;
    }
  });

  // Re-applies tabindex imperatively: an arrow move focuses without a render.
  const onFocus = useCallback((e: FocusEvent<T>) => {
    const root = ref.current;
    const button = (e.target as HTMLElement).closest('button');
    if (!root || !button || !root.contains(button)) return;
    remembered.current = button;
    for (const other of Array.from(root.querySelectorAll('button'))) {
      other.tabIndex = other === button ? 0 : -1;
    }
  }, []);

  const onKeyDown = useCallback((e: KeyboardEvent<T>) => {
    const root = ref.current;
    if (!root) return;
    // Alt+←/→ (history) and Ctrl+Home/End belong to the browser.
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const buttons = enabledButtons(root);
    if (buttons.length === 0) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let target: HTMLButtonElement | undefined;
    switch (e.key) {
      case 'ArrowRight':
        target = buttons[(index + 1) % buttons.length];
        break;
      case 'ArrowLeft':
        target = buttons[(index - 1 + buttons.length) % buttons.length];
        break;
      case 'Home':
        target = buttons[0];
        break;
      case 'End':
        target = buttons[buttons.length - 1];
        break;
      default:
        return;
    }
    e.preventDefault();
    target.focus();
  }, []);

  return { ref, onKeyDown, onFocus };
}
