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

export function parseTableWorkspaceQuery(params: {
  get(name: string): string | null;
}): TableWorkspaceQuery {
  return {
    scene: bounded(params.get('scene')),
    run: bounded(params.get('run')),
    tableWorkspace: bounded(params.get('tableWorkspace')),
    prepareEncounter: bounded(params.get('prepareEncounter')),
    panel: params.get('panel') === 'scenes' ? 'scenes' : null,
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
  return typeof single === 'string' && single.length > 0 ? single : null;
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
        : workspace.length > TABLE_QUERY_VALUE_LIMIT
          ? INVALID_WORKSPACE_MARKER
          : workspace,
  });
}
