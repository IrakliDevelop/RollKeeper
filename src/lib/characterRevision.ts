/** Guard flag: true while the store is applying state that originated
 * elsewhere (another tab, the server). Mutations made under this flag
 * must NOT bump `character.revision` — they adopt the incoming one. */
let applyingExternal = false;

export const isApplyingExternal = () => applyingExternal;

export function withExternalApply<T>(fn: () => T): T {
  applyingExternal = true;
  try {
    return fn();
  } finally {
    applyingExternal = false;
  }
}
