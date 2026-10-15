/**
 * O7-3 W5 / W8R-7 (O7-2 HN-1 "tag at source"): every Table save/scene
 * message with its tone. `routine` lines live in Details; every other
 * message is a header banner (polite status region); `failure` uses the
 * failure tone and counts on Details. A raw technical reason is kept as
 * `detail` (shown as a tooltip), never in the text.
 */
export type SaveMessageTone = 'routine' | 'progress' | 'success' | 'failure';

export interface SaveMessage {
  text: string;
  tone: SaveMessageTone;
  detail?: string;
}

const say = (text: string, tone: SaveMessageTone): SaveMessage => ({
  text,
  tone,
});

export const SAVE_MESSAGES = {
  loading: say('Loading scene…', 'routine'),
  ready: say('Scene ready', 'routine'),
  notFound: say("This scene isn't on this device.", 'failure'),
  notConnected: say(
    "Can't save a checkpoint until you're connected. Your changes are still on this device.",
    'failure'
  ),
  storageUnavailable: say(
    "Checkpoint not saved: this browser's storage isn't available.",
    'failure'
  ),
  saving: say('Waiting for the server to confirm…', 'progress'),
  saved: say('Checkpoint saved.', 'success'),
  savedWithNewerEdit: say(
    "Checkpoint saved. Your most recent change isn't in it yet.",
    'success'
  ),
  /** GG3: the offline changes slot was dropped on purpose. */
  offlineDiscarded: say('Offline changes discarded.', 'success'),
  offlineDiscardFailed: say(
    "Couldn't discard the offline changes. They are still in Details.",
    'failure'
  ),
  conflictDiscarded: say(
    'Your edit was discarded. The newer version is unchanged.',
    'success'
  ),
  conflictRefreshed: say(
    'Showing the newer version. Your edit is still waiting: try it again or discard it.',
    'success'
  ),
  conflictRefreshFailed: say(
    "Couldn't load the newer version. Your edit is still waiting.",
    'failure'
  ),
  conflictApplied: say(
    'Your edit was applied to the newer version. Other changes were kept.',
    'success'
  ),
  conflictChangedAgain: say(
    'The scene changed again. Your edit is still waiting.',
    'failure'
  ),
  conflictNone: say("There's no waiting edit.", 'success'),
  conflictApplyFailed: say(
    "Couldn't apply your edit. It's still waiting.",
    'failure'
  ),
  arrivalSaved: say('Arrival point saved.', 'success'),
  arrivalNotSaved: say(
    "The arrival point wasn't saved. Nothing changed.",
    'failure'
  ),
  mapImageFailed: say("Couldn't load the map image.", 'failure'),
} satisfies Record<string, SaveMessage>;

/** A checkpoint that was not saved; `reason` is the raw outcome. */
export function checkpointNotSaved(
  kept: 'changes-kept' | 'last-kept',
  reason: string
): SaveMessage {
  return {
    text:
      kept === 'changes-kept'
        ? 'Checkpoint not saved. Your changes are still on this device.'
        : 'Checkpoint not saved. Your last checkpoint is unchanged.',
    tone: 'failure',
    detail: reason,
  };
}

/** What can be restored from Details. */
export type RestoreKind = 'changes' | 'offline' | 'checkpoint';

const RESTORE_WORDS: Record<
  RestoreKind,
  { what: string; busy: string; done: string; notDone: string }
> = {
  changes: {
    what: 'your changes',
    busy: 'Restoring your changes…',
    done: 'Changes restored.',
    notDone: "Changes weren't",
  },
  offline: {
    what: 'your offline changes',
    busy: 'Restoring your offline changes…',
    done: 'Offline changes restored.',
    notDone: "Offline changes weren't",
  },
  checkpoint: {
    what: 'the checkpoint',
    busy: 'Restoring the checkpoint…',
    done: 'Checkpoint restored.',
    notDone: "Checkpoint wasn't",
  },
};

export function restoreMessages(kind: RestoreKind) {
  const words = RESTORE_WORDS[kind];
  const what = words.what;
  return {
    busy: say(words.busy, 'progress'),
    restored: say(words.done, 'success'),
    conflict: say(
      `${words.notDone} restored because the scene changed. Check it, then try again.`,
      'failure'
    ),
    /** PR08 desktop B1: only the live tab restores; nothing was sent. */
    notLive: say(
      `This tab isn't live, so it can't restore ${what}. Go live, then try again.`,
      'failure'
    ),
    failed: (reason: string): SaveMessage => {
      const text =
        reason === 'forbidden'
          ? `Couldn't restore ${what} because this tab isn't live. Go live, then try again.`
          : reason === 'expired'
            ? `Restoring ${what} took too long. Nothing changed. Try again.`
            : reason === 'invalid'
              ? `Couldn't restore ${what} because the saved copy can't be used. Nothing changed.`
              : `Couldn't restore ${what}. Nothing changed.`;
      return { text, tone: 'failure', detail: reason };
    },
  };
}

/** Export errors carry arbitrary text: report them tagged as failures. */
export function exportFailureReporter(
  notify: (message: string, tone: SaveMessageTone) => void
): (message: string) => void {
  return message => notify(message, 'failure');
}
