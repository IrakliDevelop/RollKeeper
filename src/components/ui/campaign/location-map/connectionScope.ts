export interface ConnectionScope {
  push(cleanup: () => void): void;
}

function guarded(step: () => void): void {
  try {
    step();
  } catch {
    // Keep unwinding — the documented teardown completes regardless.
  }
}

/**
 * Per-connection attachment sequence with unwind. Every presence helper
 * (laser, ping, measure, focus, path, awareness) is created inside `build`,
 * which pushes each helper's cleanup the moment that helper exists. If any
 * later helper throws, everything already created is disposed (push order,
 * each step guarded), the connection is stopped, and the ORIGINAL error is
 * rethrown — no half-attached handles and no orphaned socket survive. On
 * success the returned composite cleanup runs the pushed cleanups in push
 * order (matching the pre-existing `laserCleanups` iteration order the
 * teardown-order tests pin), guards each step, and is idempotent.
 */
export function attachConnectionScope(
  connection: { stop(): void },
  build: (scope: ConnectionScope) => void
): () => void {
  const cleanups: (() => void)[] = [];
  try {
    build({ push: cleanup => cleanups.push(cleanup) });
  } catch (error) {
    for (const cleanup of cleanups) guarded(cleanup);
    cleanups.length = 0;
    guarded(() => connection.stop());
    throw error;
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    for (const cleanup of cleanups) guarded(cleanup);
    cleanups.length = 0;
  };
}
