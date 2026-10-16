/**
 * W1/W8 canonical Table workspace URLs:
 * `/dm/campaign/<code>/table?scene=&run=&tableWorkspace=&prepareEncounter=&panel=`.
 * Pure helpers shared by the server redirect, the client workspace and the
 * entry points. Ids are carried raw (bounded) and validated against the
 * selected workspace by the client; nothing here trusts them.
 */

/** Upper bound for any carried query value (R3-F12). */
export const TABLE_QUERY_VALUE_LIMIT = 512;
/** Marker the client refuses with the existing "not bound" notice (C6-5). */
export const INVALID_WORKSPACE_MARKER = 'invalid';

export interface TableWorkspaceQuery {
  scene: string | null;
  run: string | null;
  tableWorkspace: string | null;
  prepareEncounter: string | null;
  panel: 'scenes' | null;
  /** `scene` was present but not a usable id (W1 "not available"). */
  sceneInvalid?: boolean;
}

const ORDER = [
  'scene',
  'run',
  'tableWorkspace',
  'prepareEncounter',
  'panel',
] as const;

// Control characters are never part of an id.
const CONTROL = /[\u0000-\u001f\u007f]/u;

function bounded(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (value.length > TABLE_QUERY_VALUE_LIMIT || CONTROL.test(value))
    return null;
  return value;
}

const encoder = new TextEncoder();

/** A local workspace / scene id: 1–255 UTF-8 bytes, no control characters. */
function isRouteId(value: string): boolean {
  return (
    value.length > 0 &&
    encoder.encode(value).byteLength <= 255 &&
    !CONTROL.test(value)
  );
}

/**
 * R3-F12 / review F2: an explicit workspace selection is never dropped —
 * a present but unusable value becomes the refusal marker, so the client
 * shows "not bound" instead of opening the default workspace.
 */
function workspaceSelection(value: string | null): string | null {
  if (value === null) return null;
  return isRouteId(value) ? value : INVALID_WORKSPACE_MARKER;
}

export function parseTableWorkspaceQuery(params: {
  get(name: string): string | null;
  has?(name: string): boolean;
}): TableWorkspaceQuery {
  const rawScene = params.get('scene');
  const scene = rawScene !== null && isRouteId(rawScene) ? rawScene : null;
  return {
    scene,
    run: bounded(params.get('run')),
    tableWorkspace: workspaceSelection(params.get('tableWorkspace')),
    prepareEncounter: bounded(params.get('prepareEncounter')),
    panel: params.get('panel') === 'scenes' ? 'scenes' : null,
    sceneInvalid: rawScene !== null && scene === null,
  };
}

export function tableWorkspaceHref(
  campaignCode: string,
  query: Partial<TableWorkspaceQuery>
): string {
  const params = new URLSearchParams();
  for (const key of ORDER) {
    const value = query[key];
    if (typeof value === 'string' && value.length > 0) params.set(key, value);
  }
  const search = params.toString();
  return `/dm/campaign/${encodeURIComponent(campaignCode)}/table${search ? `?${search}` : ''}`;
}

function first(value: string | string[] | undefined): string | null {
  const single = Array.isArray(value) ? value[0] : value;
  return typeof single === 'string' ? single : null;
}

/**
 * W8 row 1 / R3-F12 / C6-5: the old `table/<sceneId>` URL maps to
 * `?scene=<sceneId>` keeping `run` and `tableWorkspace` raw. An oversized
 * workspace selection becomes the marker the client refuses — it never
 * falls back to the default workspace. Unknown parameters are dropped.
 */
export function legacyTableRedirectHref(
  campaignCode: string,
  sceneId: string,
  search: Record<string, string | string[] | undefined>
): string {
  const workspace = first(search.tableWorkspace);
  return tableWorkspaceHref(campaignCode, {
    scene: sceneId,
    run: first(search.run)?.slice(0, TABLE_QUERY_VALUE_LIMIT) ?? null,
    tableWorkspace:
      workspace === null
        ? null
        : workspace.length === 0 ||
            workspace.length > TABLE_QUERY_VALUE_LIMIT ||
            CONTROL.test(workspace)
          ? INVALID_WORKSPACE_MARKER
          : workspace,
  });
}
