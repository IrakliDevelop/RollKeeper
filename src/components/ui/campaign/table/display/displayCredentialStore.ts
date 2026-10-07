import type { DisplayCredential } from './displayRequests';

/**
 * PR05 E8 bootstrap: the capability arrives once in the URL fragment (or,
 * for an old map-pinned URL, `?dk=`), is moved into this tab's
 * sessionStorage with a fresh session nonce, and the URL is scrubbed before
 * any request. Never localStorage, never logged. A blocked sessionStorage
 * keeps the credential in memory for this page load only.
 */
export const displayStorageKey = (code: string) =>
  `rollkeeper:table-display:${code}`;
/** Table v1 off: the legacy map-pinned key keeps its own entry (C5-4). */
export const legacyDisplayStorageKey = (code: string) =>
  `rollkeeper:legacy-display-key:${code}`;

const CAPABILITY = /^[A-Za-z0-9_-]{43}$/u;
const NONCE = /^[A-Za-z0-9_-]{22}$/u;

export interface DisplayEnvironment {
  location: {
    readonly hash: string;
    readonly search: string;
    readonly pathname: string;
  };
  history: {
    replaceState(data: unknown, unused: string, url?: string | null): void;
  };
  /** May throw (blocked storage). */
  storage: () => Storage;
}

export type DisplayBootstrap =
  | { status: 'ready'; credential: DisplayCredential; persisted: boolean }
  /** A present but malformed link: expired, without any request. */
  | { status: 'expired' }
  | { status: 'missing' };

export function browserDisplayEnvironment(): DisplayEnvironment {
  return {
    location: window.location,
    history: window.history,
    storage: () => window.sessionStorage,
  };
}

/** 16 random bytes as base64url (22 characters). */
export function generateDisplayNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_')
    .replace(/=+$/u, '');
}

function readStored(env: DisplayEnvironment, key: string): string | null {
  try {
    return env.storage().getItem(key);
  } catch {
    return null;
  }
}

function writeStored(
  env: DisplayEnvironment,
  key: string,
  value: string
): boolean {
  try {
    env.storage().setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeStored(env: DisplayEnvironment, key: string): void {
  try {
    env.storage().removeItem(key);
  } catch {
    // Blocked storage holds nothing to remove.
  }
}

function storedCredential(
  env: DisplayEnvironment,
  code: string
): DisplayCredential | null {
  const raw = readStored(env, displayStorageKey(code));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return CAPABILITY.test(String(value.capability)) &&
      NONCE.test(String(value.nonce))
      ? { capability: String(value.capability), nonce: String(value.nonce) }
      : null;
  } catch {
    return null;
  }
}

function adopt(
  env: DisplayEnvironment,
  code: string,
  capability: string
): DisplayBootstrap {
  if (!CAPABILITY.test(capability)) {
    removeStored(env, displayStorageKey(code));
    return { status: 'expired' };
  }
  const credential = { capability, nonce: generateDisplayNonce() };
  const persisted = writeStored(
    env,
    displayStorageKey(code),
    JSON.stringify(credential)
  );
  return { status: 'ready', credential, persisted };
}

function fromStorage(env: DisplayEnvironment, code: string): DisplayBootstrap {
  const credential = storedCredential(env, code);
  return credential
    ? { status: 'ready', credential, persisted: true }
    : { status: 'missing' };
}

/** `/table-display/<code>#k=<capability>` bootstrap (E8.1–E8.3). */
export function bootstrapCampaignDisplay(
  code: string,
  env: DisplayEnvironment = browserDisplayEnvironment()
): DisplayBootstrap {
  const hash = env.location.hash.replace(/^#/u, '');
  if (!hash) return fromStorage(env, code);
  const capability = new URLSearchParams(hash).get('k');
  env.history.replaceState(null, '', env.location.pathname);
  return capability === null
    ? fromStorage(env, code)
    : adopt(env, code, capability);
}

/**
 * Old map-pinned URL `?dk=` (E8 map-pinned, C5-4): under Table v1 the key
 * is consumed exactly like the fragment (same campaign entry, fresh nonce);
 * with v1 off the legacy key keeps its own entry and legacy auth. The query
 * is scrubbed before any request in both modes.
 */
export function bootstrapMapPinnedDisplay(
  code: string,
  v1: boolean,
  env: DisplayEnvironment = browserDisplayEnvironment()
): DisplayBootstrap | { status: 'legacy'; displayKey: string } {
  const key = new URLSearchParams(env.location.search).get('dk');
  if (key !== null) env.history.replaceState(null, '', env.location.pathname);
  if (v1) return key === null ? fromStorage(env, code) : adopt(env, code, key);
  if (key !== null && key.length > 0 && key.length <= 200) {
    writeStored(env, legacyDisplayStorageKey(code), key);
    return { status: 'legacy', displayKey: key };
  }
  const stored = readStored(env, legacyDisplayStorageKey(code));
  return stored
    ? { status: 'legacy', displayKey: stored }
    : { status: 'missing' };
}

/**
 * Re-scrubs a credential-bearing URL once the Next.js router has installed
 * its history patch (the next commit after bootstrap): the first scrub runs
 * during hydration, before the router knows about it, and a later router
 * history sync would otherwise restore the canonical URL with the secret.
 */
export function scrubDisplayUrl(
  env: DisplayEnvironment = browserDisplayEnvironment()
): void {
  const { hash, search, pathname } = env.location;
  if (hash.length > 1 || new URLSearchParams(search).has('dk'))
    env.history.replaceState(null, '', pathname);
}

/** E8.4: drop the stored credential after a credential denial. */
export function clearDisplayCredential(
  code: string,
  env: DisplayEnvironment = browserDisplayEnvironment()
): void {
  removeStored(env, displayStorageKey(code));
}
