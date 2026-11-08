import { CHARACTER_CUTOVER_SELECTION_PREFIX } from '@/lib/indexeddb/characterCutoverSelection';
import { PLAYER_STORAGE_KEY } from '@/utils/constants';

export const CONTINUE_SLOT_ID = 'launcher-continue';
export const CONTINUE_TEMPLATE_ID = 'launcher-continue-template';

export interface LastCharacter {
  id: string;
  name: string;
}

/**
 * The most recently played character that isn't archived, read from the
 * player store's persisted JSON (`{ state: { characters } }`). Mirrors
 * `useLastCharacter`. It is serialised into the static launcher page, so it
 * must stay self-contained: no imports, no closures.
 */
export function pickLastCharacter(raw: string | null): LastCharacter | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const list = parsed && parsed.state && parsed.state.characters;
    if (!Array.isArray(list)) return null;
    let best: LastCharacter | null = null;
    let bestTime = -Infinity;
    for (const c of list) {
      if (!c || c.isArchived) continue;
      if (typeof c.id !== 'string' || typeof c.name !== 'string') continue;
      const time = new Date(c.lastPlayed).getTime();
      const t = Number.isNaN(time) ? 0 : time;
      if (best === null || t > bestTime) {
        best = { id: c.id, name: c.name };
        bestTime = t;
      }
    }
    return best;
  } catch {
    return null;
  }
}

/**
 * The static launcher's only behaviour: show "Open {name}'s sheet" for the
 * last character played on this device. Characters are read from the
 * player store's localStorage copy; once a device has moved characters to
 * IndexedDB that copy can be stale, so the link is left out there.
 */
export const staticContinueScript = `
(function() {
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(${JSON.stringify(CHARACTER_CUTOVER_SELECTION_PREFIX)}) === 0) return;
    }
    var pick = ${pickLastCharacter.toString()};
    var last = pick(localStorage.getItem(${JSON.stringify(PLAYER_STORAGE_KEY)}));
    if (!last) return;
    var slot = document.getElementById(${JSON.stringify(CONTINUE_SLOT_ID)});
    var template = document.getElementById(${JSON.stringify(CONTINUE_TEMPLATE_ID)});
    if (!slot || !template) return;
    var link = template.content.firstElementChild.cloneNode(true);
    link.setAttribute('href', '/player/characters/' + encodeURIComponent(last.id));
    link.textContent = 'Open ' + last.name + "'s sheet";
    slot.replaceWith(link);
  } catch (e) {}
})();
`;
