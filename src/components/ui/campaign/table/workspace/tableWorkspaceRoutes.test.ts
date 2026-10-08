import { describe, expect, it } from 'vitest';

import {
  legacyTableRedirectHref,
  parseTableWorkspaceQuery,
  tableWorkspaceHref,
} from './tableWorkspaceRoutes';

describe('W1 canonical Table workspace URLs', () => {
  it('builds the canonical URL with only known, encoded parameters', () => {
    expect(tableWorkspaceHref('CAMP 1', {})).toBe(
      '/dm/campaign/CAMP%201/table'
    );
    expect(
      tableWorkspaceHref('CAMP', {
        scene: 'scene a/b',
        run: 'run-1',
        tableWorkspace: 'imported-1',
        prepareEncounter: 'enc-1',
        panel: 'scenes',
      })
    ).toBe(
      '/dm/campaign/CAMP/table?scene=scene+a%2Fb&run=run-1&tableWorkspace=imported-1&prepareEncounter=enc-1&panel=scenes'
    );
  });

  it('parses bounded values and drops empty, oversized or control-character values', () => {
    expect(
      parseTableWorkspaceQuery(
        new URLSearchParams(
          'scene=scene-1&run=run-1&tableWorkspace=w1&prepareEncounter=e1&panel=scenes&other=x'
        )
      )
    ).toEqual({
      scene: 'scene-1',
      run: 'run-1',
      tableWorkspace: 'w1',
      prepareEncounter: 'e1',
      panel: 'scenes',
    });
    const invalid = parseTableWorkspaceQuery(
      new URLSearchParams(
        `scene=${'x'.repeat(513)}&run=&panel=nope&prepareEncounter=%00`
      )
    );
    expect(invalid).toMatchObject({
      scene: null,
      run: null,
      panel: null,
      prepareEncounter: null,
    });
    // An explicit but invalid workspace selection is kept so the client can
    // refuse it ("not bound") instead of opening the default workspace.
    expect(
      parseTableWorkspaceQuery(new URLSearchParams('tableWorkspace=invalid'))
        .tableWorkspace
    ).toBe('invalid');
  });
});

describe('W8 / R3-F12 legacy table/<sceneId> redirect target', () => {
  it('maps the scene into ?scene= and preserves run and tableWorkspace raw', () => {
    expect(
      legacyTableRedirectHref('CAMP', 'scene-1', {
        run: 'run-7',
        tableWorkspace: 'imported workspace',
        unknown: 'dropped',
      })
    ).toBe(
      '/dm/campaign/CAMP/table?scene=scene-1&run=run-7&tableWorkspace=imported+workspace'
    );
    expect(legacyTableRedirectHref('CAMP', 'scene-1', {})).toBe(
      '/dm/campaign/CAMP/table?scene=scene-1'
    );
  });

  it('keeps the first value of repeated parameters', () => {
    expect(
      legacyTableRedirectHref('CAMP', 'scene-1', { run: ['run-a', 'run-b'] })
    ).toBe('/dm/campaign/CAMP/table?scene=scene-1&run=run-a');
  });

  it('marks an oversized tableWorkspace instead of dropping to the default workspace (C6-5)', () => {
    expect(
      legacyTableRedirectHref('CAMP', 'scene-1', {
        tableWorkspace: 'w'.repeat(513),
      })
    ).toBe('/dm/campaign/CAMP/table?scene=scene-1&tableWorkspace=invalid');
    expect(
      legacyTableRedirectHref('CAMP', 'scene-1', {
        tableWorkspace: 'w'.repeat(512),
      })
    ).toBe(
      `/dm/campaign/CAMP/table?scene=scene-1&tableWorkspace=${'w'.repeat(512)}`
    );
  });

  it('carries an oversized scene id raw so the workspace shows its unavailable notice', () => {
    const href = legacyTableRedirectHref('CAMP', 'z'.repeat(300), {});
    expect(href).toBe(`/dm/campaign/CAMP/table?scene=${'z'.repeat(300)}`);
  });
});
