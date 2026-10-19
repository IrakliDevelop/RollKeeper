/**
 * In-app replacements for window.confirm, window.alert and window.prompt.
 *
 * Call sites await a promise; one <ConfirmDialogHost /> at the app root
 * renders the requests one at a time, in the order they were made. A
 * module-level queue (not a React context) lets hooks, effects-free
 * handlers and components that return early all reach the same dialog.
 */

export type ConfirmDialogTone = 'default' | 'danger';

export interface ConfirmDialogOptions {
  title: string;
  message?: string;
  /** Verb that names the outcome, e.g. "Delete spell". */
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` = blood confirm button and role="alertdialog". */
  tone?: ConfirmDialogTone;
}

export interface AlertDialogOptions {
  title: string;
  message?: string;
  closeLabel?: string;
}

export interface PromptDialogOptions {
  title: string;
  message?: string;
  /** Visible label of the text field. */
  label: string;
  defaultValue?: string;
  confirmLabel: string;
  cancelLabel?: string;
}

export type DialogRequest =
  | ({ kind: 'confirm'; id: number } & ConfirmDialogOptions)
  | ({ kind: 'alert'; id: number } & AlertDialogOptions)
  | ({ kind: 'prompt'; id: number } & PromptDialogOptions);

/** confirm → boolean, alert → true, prompt → string or null. */
export type DialogResult = boolean | string | null;

interface QueueEntry {
  request: DialogRequest;
  resolve: (result: DialogResult) => void;
  /** The control that had focus when the first queued request was made. */
  returnFocus: Element | null;
}

type Listener = () => void;

let queue: QueueEntry[] = [];
let nextId = 1;
/** Mounted hosts in registration order; only the first one renders. */
let hosts: object[] = [];
/**
 * Where the most recently resolved dialog was going to return focus. A
 * dialog opened while that one is still animating out would otherwise
 * capture the closing dialog's own button as its opener.
 */
let lastReturnFocus: Element | null = null;
/** True until the end of the tick in which a dialog was resolved. */
let resolvedThisTick = false;

function rememberReturnFocus(element: Element | null) {
  lastReturnFocus = element;
  resolvedThisTick = true;
  setTimeout(() => {
    resolvedThisTick = false;
  }, 0);
}
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

function cancelledResult(request: DialogRequest): DialogResult {
  if (request.kind === 'prompt') return null;
  if (request.kind === 'alert') return true;
  return false;
}

function captureOpener(): Element | null {
  if (typeof document === 'undefined') return null;
  const active = document.activeElement;
  // Chained dialogs: the closing dialog's button, or the page body once that
  // button is gone, is not an opener.
  const leftBehind =
    active?.closest('[data-confirm-dialog]') ||
    (resolvedThisTick && (!active || active === document.body));
  return leftBehind ? lastReturnFocus : active;
}

function enqueue(request: DialogRequest): Promise<DialogResult> {
  if (hosts.length === 0) {
    // A missing host must never read as consent: cancel, and say why.
    console.error(
      `[confirm-dialog] No <ConfirmDialogHost /> is mounted, so "${request.title}" was cancelled.`
    );
    return Promise.resolve(cancelledResult(request));
  }
  const returnFocus = queue[0]?.returnFocus ?? captureOpener();
  return new Promise(resolve => {
    queue = [...queue, { request, resolve, returnFocus }];
    emit();
  });
}

/** Resolves true when the user confirms, false on Cancel or Escape. */
export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return enqueue({ ...options, kind: 'confirm', id: nextId++ }).then(
    result => result === true
  );
}

/** Resolves when the user closes the dialog. */
export function alertDialog(options: AlertDialogOptions): Promise<void> {
  return enqueue({ ...options, kind: 'alert', id: nextId++ }).then(
    () => undefined
  );
}

/** Resolves to the entered text, or null on Cancel or Escape. */
export function promptDialog(
  options: PromptDialogOptions
): Promise<string | null> {
  return enqueue({ ...options, kind: 'prompt', id: nextId++ }).then(result =>
    typeof result === 'string' ? result : null
  );
}

// ---- Host side --------------------------------------------------------

export function subscribeDialogQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCurrentDialog(): DialogRequest | null {
  return queue[0]?.request ?? null;
}

/** Where focus goes when the current dialog closes. */
export function getDialogReturnFocus(): Element | null {
  return queue[0]?.returnFocus ?? null;
}

export function resolveCurrentDialog(id: number, result: DialogResult) {
  const [head, ...rest] = queue;
  if (!head || head.request.id !== id) return;
  queue = rest;
  rememberReturnFocus(head.returnFocus);
  head.resolve(result);
  emit();
}

/** Cancels the open dialog and everything queued behind it. */
export function cancelAllDialogs() {
  if (queue.length === 0) return;
  const pending = queue;
  queue = [];
  rememberReturnFocus(pending[0].returnFocus);
  for (const entry of pending) entry.resolve(cancelledResult(entry.request));
  emit();
}

/** The mounted host that renders the dialogs, or null when none is mounted. */
export function getActiveDialogHost(): object | null {
  return hosts[0] ?? null;
}

/**
 * Registers a mounted host. Several hosts may be mounted (a Storybook docs
 * page has one per story); only the first registered still-mounted host
 * renders, so a request never shows twice.
 */
export function registerDialogHost(token: object): () => void {
  hosts = [...hosts, token];
  emit();
  return () => {
    hosts = hosts.filter(host => host !== token);
    if (hosts.length === 0) cancelAllDialogs();
    emit();
  };
}
