export interface WriterLockCallbacks {
  onPromoted: (characterId: string) => void;
}

const LOCK_PREFIX = 'rk-character-writer-';

const locksSupported = (): boolean =>
  typeof navigator !== 'undefined' &&
  'locks' in navigator &&
  typeof navigator.locks?.request === 'function';

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name: unknown }).name === 'AbortError';

/** Single-writer election. One instance per JS context (singleton export).
 * Holds at most one character's writer lock at a time; switching characters
 * releases the old lock BEFORE requesting the new one. Without Web Locks
 * support every tab reports leader — the storage tiebreak (spec §reduced
 * guarantees) is the only convergence mechanism there. */
export class CharacterWriterLock {
  private heldFor: string | null = null;
  private targetId: string | null = null;
  private releaseHeld: (() => void) | null = null;
  private abortQueued: AbortController | null = null;

  isLeader(characterId: string): boolean {
    if (!locksSupported()) return true;
    return this.heldFor === characterId;
  }

  switchTo(characterId: string, callbacks: WriterLockCallbacks): void {
    if (this.targetId === characterId) return;
    this.targetId = characterId;

    // Release current hold and/or cancel a queued request.
    this.abortQueued?.abort();
    this.abortQueued = null;
    this.releaseHeld?.();
    this.releaseHeld = null;
    this.heldFor = null;

    if (!characterId || !locksSupported()) return;

    const abort = new AbortController();
    this.abortQueued = abort;
    void navigator.locks
      .request(
        LOCK_PREFIX + characterId,
        { mode: 'exclusive', signal: abort.signal },
        () =>
          new Promise<void>(resolve => {
            if (this.targetId !== characterId) {
              resolve(); // switched away while queued — hand the lock on
              return;
            }
            this.heldFor = characterId;
            this.releaseHeld = () => {
              if (this.heldFor === characterId) this.heldFor = null;
              resolve();
            };
            try {
              callbacks.onPromoted(characterId);
            } catch (error) {
              // A throwing onPromoted must not leave this instance stuck
              // "leading" after the browser has already released the real
              // lock to the next queued tab — that's split-brain. Clear our
              // state, log, and resolve (release cleanly) instead of letting
              // the executor's promise auto-reject.
              console.error('CharacterWriterLock: onPromoted threw', error);
              if (this.heldFor === characterId) this.heldFor = null;
              this.releaseHeld = null;
              resolve();
            }
          })
      )
      .catch((error: unknown) => {
        if (isAbortError(error)) return; // expected on switch/cancel
        console.error('CharacterWriterLock: lock request failed', error);
      });
  }
}

export const characterWriterLock = new CharacterWriterLock();
