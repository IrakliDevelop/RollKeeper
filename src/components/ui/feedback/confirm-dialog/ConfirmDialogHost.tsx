'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { usePathname } from 'next/navigation';
import { ConfirmDialogView } from './ConfirmDialogView';
import {
  cancelAllDialogs,
  getActiveDialogHost,
  getCurrentDialog,
  getDialogReturnFocus,
  registerDialogHost,
  resolveCurrentDialog,
  subscribeDialogQueue,
  type DialogRequest,
} from './confirmDialogStore';

const getServerSnapshot = () => null;

/**
 * Renders confirmDialog / alertDialog / promptDialog requests. Mount it
 * once, at the app root (and in Storybook and tests that open dialogs).
 */
export function ConfirmDialogHost() {
  const current = useSyncExternalStore(
    subscribeDialogQueue,
    getCurrentDialog,
    getServerSnapshot
  );

  // Several hosts may be mounted; only the first one renders.
  const [hostToken] = useState(() => ({}));
  const activeHost = useSyncExternalStore(
    subscribeDialogQueue,
    getActiveDialogHost,
    getServerSnapshot
  );

  // Keep the last request on screen while its exit animation runs.
  const [last, setLast] = useState<{
    request: DialogRequest;
    returnFocus: Element | null;
  } | null>(null);
  if (current && current !== last?.request) {
    setLast({ request: current, returnFocus: getDialogReturnFocus() });
  }
  const shown = current ?? last?.request ?? null;

  useEffect(() => registerDialogHost(hostToken), [hostToken]);

  // A dialog belongs to the screen that opened it: leaving the screen
  // cancels it, so its handler never runs against the next page.
  const pathname = usePathname();
  const firstPathname = useRef(pathname);
  useEffect(() => {
    if (pathname === firstPathname.current) return;
    firstPathname.current = pathname;
    cancelAllDialogs();
  }, [pathname]);

  if (!shown || activeHost !== hostToken) return null;

  const open = current !== null;
  const resolve = (result: boolean | string | null) =>
    resolveCurrentDialog(shown.id, result);

  return (
    <ConfirmDialogView
      key={shown.id}
      open={open}
      kind={shown.kind}
      title={shown.title}
      message={shown.message}
      tone={shown.kind === 'confirm' ? shown.tone : 'default'}
      confirmLabel={
        shown.kind === 'alert'
          ? (shown.closeLabel ?? 'Close')
          : shown.confirmLabel
      }
      cancelLabel={shown.kind === 'alert' ? undefined : shown.cancelLabel}
      promptLabel={shown.kind === 'prompt' ? shown.label : undefined}
      defaultValue={shown.kind === 'prompt' ? shown.defaultValue : undefined}
      returnFocusTo={last?.request === shown ? last.returnFocus : null}
      onConfirm={value =>
        resolve(shown.kind === 'prompt' ? (value ?? null) : true)
      }
      onCancel={() =>
        resolve(
          shown.kind === 'prompt' ? null : shown.kind === 'alert' ? true : false
        )
      }
    />
  );
}
