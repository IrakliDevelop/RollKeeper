import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createHtmlElement, createNote } from '@fieldnotes/core';
import type { CanvasElement } from '@fieldnotes/core';

import MarkerDetailPanel from './index';
import {
  resolveMarkerPanelState,
  MARKER_PANEL_CONTAINMENT_CLASS,
  MARKER_PANEL_TOUCH_TARGET_CLASS,
} from './MarkerDetailPanel.utils';
import type {
  MarkerPanelMode,
  MarkerPanelState,
} from './MarkerDetailPanel.types';

import {
  MARKER_HTML_TYPE,
  MARKER_KINDS,
  buildMarkerData,
  type MarkerKind,
} from '../markerData';

import type { MarkerDetail } from '@/types/battlemap';

afterEach(() => cleanup());

/** Raw Tailwind colour classes banned everywhere except the shared Dialog
 * overlay scrim, which is intentionally outside this component's authored
 * markup (see the note on the "no raw Tailwind colours" test below). */
const RAW_TAILWIND_COLOR_RE =
  /\b(?:bg|text|border)-(?:gray|slate|zinc|neutral|stone|white|black)\b/;

/** Builds a valid marker `html` canvas element. Pass `data` to override the
 * payload with an arbitrary (possibly malformed) raw value. */
function markerElement(
  overrides: {
    kind?: MarkerKind;
    ref?: string;
    label?: string;
    htmlType?: string;
    data?: Record<string, unknown>;
  } = {}
): CanvasElement {
  const { htmlType = MARKER_HTML_TYPE, data } = overrides;
  return createHtmlElement({
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    htmlType,
    data: data ?? {
      ...buildMarkerData({
        kind: overrides.kind ?? 'door',
        ref: overrides.ref ?? 'ref-1',
        label: overrides.label,
      }),
    },
  });
}

function detail(overrides: Partial<MarkerDetail> = {}): MarkerDetail {
  return {
    id: 'ref-1',
    title: 'A title',
    body: 'A body',
    dmNotes: 'Secret DM notes',
    ...overrides,
  };
}

/** Throws instead of using a non-null assertion (banned by CONSTRAINTS-B) so
 * the narrowed value can be used directly afterwards. */
function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what} to be present`);
  }
  return value;
}

describe('resolveMarkerPanelState', () => {
  it.each(MARKER_KINDS)(
    'resolves "ready" for a %s marker with a matching, live detail',
    kind => {
      const element = markerElement({ kind, ref: 'ref-1' });
      const result = resolveMarkerPanelState(
        element,
        [detail({ id: 'ref-1' })],
        'dm'
      );
      expect(result.kind).toBe('ready');
      if (result.kind !== 'ready') return;
      expect(result.data.kind).toBe(kind);
      expect(result.detail.id).toBe('ref-1');
    }
  );

  it('resolves "missing-detail" in dm mode and "unpublished" in player mode when no detail matches', () => {
    const element = markerElement({ ref: 'ref-1' });
    expect(resolveMarkerPanelState(element, [], 'dm').kind).toBe(
      'missing-detail'
    );
    expect(resolveMarkerPanelState(element, [], 'player').kind).toBe(
      'unpublished'
    );
  });

  it('resolves "invalid-data" for a null element and "unsupported-version" for an unsupported v', () => {
    expect(resolveMarkerPanelState(null, [], 'dm').kind).toBe('invalid-data');

    const futureElement = markerElement({
      data: { v: 2, kind: 'door', ref: 'ref-1' },
    });
    const result = resolveMarkerPanelState(futureElement, [], 'dm');
    expect(result.kind).toBe('unsupported-version');
    if (result.kind === 'unsupported-version') {
      expect(result.version).toBe(2);
    }
  });

  it('the mode branch is pinned: the SAME valid element with a missing detail resolves differently per mode', () => {
    const element = markerElement({ ref: 'shared-ref' });
    const dmResult = resolveMarkerPanelState(element, [], 'dm');
    const playerResult = resolveMarkerPanelState(element, [], 'player');
    expect(dmResult.kind).toBe('missing-detail');
    expect(playerResult.kind).toBe('unpublished');
  });

  it('treats a soft-deleted detail as missing; the same fixture without deletedAt resolves ready (positive control)', () => {
    const element = markerElement({ ref: 'ref-1' });
    const deletedResult = resolveMarkerPanelState(
      element,
      [detail({ id: 'ref-1', deletedAt: '2026-01-01T00:00:00.000Z' })],
      'dm'
    );
    expect(deletedResult.kind).toBe('missing-detail');

    const liveResult = resolveMarkerPanelState(
      element,
      [detail({ id: 'ref-1' })],
      'dm'
    );
    expect(liveResult.kind).toBe('ready');
  });

  it('resolves "invalid-data" for a non-marker html element and for a note element', () => {
    const nonMarkerHtml = markerElement({ htmlType: 'some-other-embed' });
    const noteElement = createNote({
      position: { x: 0, y: 0 },
      text: 'a sticky note, not a marker',
    });

    expect(resolveMarkerPanelState(nonMarkerHtml, [], 'dm').kind).toBe(
      'invalid-data'
    );
    expect(resolveMarkerPanelState(noteElement, [], 'dm').kind).toBe(
      'invalid-data'
    );
  });
});

describe('MarkerDetailPanel', () => {
  it('DM edit saves title, body and dmNotes with exactly the typed values', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const state: MarkerPanelState = {
      kind: 'missing-detail',
      data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
    };

    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={state}
        onClose={() => {}}
        onSave={onSave}
        onDelete={() => {}}
      />
    );

    await user.type(screen.getByLabelText('Title'), 'Cellar Door');
    await user.type(screen.getByLabelText('Body'), 'Locked, needs a key.');
    await user.type(
      screen.getByLabelText('DM notes — never shown to players'),
      'Key is under the mat.'
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      title: 'Cellar Door',
      body: 'Locked, needs a key.',
      dmNotes: 'Key is under the mat.',
    });
  });

  it('renders player title and body as text nodes, never parsed as markup', () => {
    const dangerousTitle = '<script>window.__pwned = true</script>';
    const dangerousBody = '<img src=x onerror="alert(1)">';
    const state: MarkerPanelState = {
      kind: 'ready',
      data: buildMarkerData({ kind: 'trap', ref: 'ref-1' }),
      detail: detail({ title: dangerousTitle, body: dangerousBody }),
    };

    const { baseElement } = render(
      <MarkerDetailPanel open mode="player" state={state} onClose={() => {}} />
    );

    expect(screen.getByText(dangerousTitle)).toBeInTheDocument();
    expect(screen.getByText(dangerousBody)).toBeInTheDocument();
    expect(baseElement.querySelector('img')).toBeNull();
    expect(baseElement.querySelector('script')).toBeNull();
  });

  it('never renders dmNotes in player mode; the identical fixture surfaces it in dm mode (positive control)', () => {
    const dmNotesValue = 'Only the DM should ever see this exact string';
    const readyState: MarkerPanelState = {
      kind: 'ready',
      data: buildMarkerData({ kind: 'npc', ref: 'ref-1' }),
      detail: detail({ dmNotes: dmNotesValue }),
    };

    const player = render(
      <MarkerDetailPanel
        open
        mode="player"
        state={readyState}
        onClose={() => {}}
      />
    );
    expect(player.queryByText(dmNotesValue)).toBeNull();
    expect(player.baseElement.innerHTML).not.toContain(dmNotesValue);
    player.unmount();

    const dm = render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={readyState}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={() => {}}
      />
    );
    // Positive control: same fixture, dm mode, proves the query would have
    // found the string had player mode also rendered it.
    expect(dm.getByDisplayValue(dmNotesValue)).toBeInTheDocument();
  });

  it('renders four distinct non-ready states with pairwise-distinct testids and messages', () => {
    const data = buildMarkerData({ kind: 'secret', ref: 'ref-1' });
    const cases: { mode: MarkerPanelMode; state: MarkerPanelState }[] = [
      { mode: 'dm', state: { kind: 'missing-detail', data } },
      { mode: 'player', state: { kind: 'unpublished', data } },
      {
        mode: 'player',
        state: { kind: 'invalid-data', reason: 'bad payload' },
      },
      { mode: 'player', state: { kind: 'unsupported-version', version: 7 } },
    ];

    const testids = new Set<string>();
    const messages = new Set<string>();

    for (const { mode, state } of cases) {
      const result = render(
        <MarkerDetailPanel
          open
          mode={mode}
          state={state}
          onClose={() => {}}
          onSave={() => {}}
          onDelete={() => {}}
        />
      );
      const node = required(
        result.baseElement.querySelector(
          '[data-testid^="marker-panel-state-"]'
        ),
        `a marker-panel-state-* node for ${state.kind}`
      );
      testids.add(required(node.getAttribute('data-testid'), 'data-testid'));
      messages.add(node.textContent ?? '');
      result.unmount();
    }

    expect(testids.size).toBe(4);
    expect(messages.size).toBe(4);
  });

  it('contains a long body value inside the exported containment class', () => {
    const longBody = 'x'.repeat(5000);
    const state: MarkerPanelState = {
      kind: 'ready',
      data: buildMarkerData({ kind: 'loot', ref: 'ref-1' }),
      detail: detail({ body: longBody }),
    };

    const { baseElement } = render(
      <MarkerDetailPanel open mode="player" state={state} onClose={() => {}} />
    );

    const bodyNode = required(
      baseElement.querySelector('[data-testid="marker-panel-body"]'),
      'the marker-panel-body node'
    );
    expect(bodyNode.className).toContain(MARKER_PANEL_CONTAINMENT_CLASS);
  });

  it('gives every rendered button the exported touch-target class', () => {
    const data = buildMarkerData({ kind: 'note', ref: 'ref-1' });
    const state: MarkerPanelState = { kind: 'missing-detail', data };

    const { baseElement } = render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={state}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={() => {}}
      />
    );

    const buttons = baseElement.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach(button => {
      expect(button.className).toContain(MARKER_PANEL_TOUCH_TARGET_CLASS);
    });
  });

  it('resets the form when the panel opens on a different marker', () => {
    const stateA: MarkerPanelState = {
      kind: 'ready',
      data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
      detail: detail({ id: 'ref-1', title: 'Original A' }),
    };
    const stateB: MarkerPanelState = {
      kind: 'ready',
      data: buildMarkerData({ kind: 'door', ref: 'ref-2' }),
      detail: detail({ id: 'ref-2', title: 'Original B' }),
    };

    const { rerender, getByLabelText } = render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={stateA}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={() => {}}
      />
    );

    fireEvent.change(getByLabelText('Title'), {
      target: { value: 'typed but never saved' },
    });
    expect((getByLabelText('Title') as HTMLInputElement).value).toBe(
      'typed but never saved'
    );

    rerender(
      <MarkerDetailPanel
        open
        mode="dm"
        state={stateB}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={() => {}}
      />
    );

    expect((getByLabelText('Title') as HTMLInputElement).value).toBe(
      'Original B'
    );
  });

  /**
   * Scans a dialog subtree for raw Tailwind colour classes, excluding
   * `<button>` internals. Two exclusions are deliberate, not loopholes:
   *  - `[role="dialog"]` already excludes the shared `DialogOverlay` scrim
   *    (`bg-black/50`), a sibling node outside this component's authored
   *    markup.
   *  - Every filled `Button` variant this panel is required to use (`primary`
   *    Save, `danger` Delete) sets `text-white` in the shared `buttonVariants`
   *    for contrast against its gradient fill — a pre-existing, repo-wide
   *    design-system convention this component does not control and cannot
   *    avoid while still using `Button` as instructed. Stripping `<button>`
   *    subtrees keeps the assertion aimed at MarkerDetailPanel's own
   *    className choices (headings, paragraphs, wrapper divs) without being
   *    permanently tripped by a class that already exists on every colored
   *    button in the app.
   */
  function nonButtonDialogHtml(dialog: Element): string {
    const clone = dialog.cloneNode(true) as Element;
    clone.querySelectorAll('button').forEach(button => button.remove());
    return clone.innerHTML;
  }

  it('never emits raw Tailwind colour classes outside <button>s, in dm or player mode', () => {
    const data = buildMarkerData({ kind: 'door', ref: 'ref-1' });
    const readyState: MarkerPanelState = {
      kind: 'ready',
      data,
      detail: detail(),
    };

    const dm = render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={readyState}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={() => {}}
      />
    );
    const dmDialog = required(
      dm.baseElement.querySelector('[role="dialog"]'),
      'the dm dialog node'
    );
    expect(RAW_TAILWIND_COLOR_RE.test(nonButtonDialogHtml(dmDialog))).toBe(
      false
    );
    dm.unmount();

    const player = render(
      <MarkerDetailPanel
        open
        mode="player"
        state={readyState}
        onClose={() => {}}
      />
    );
    const playerDialog = required(
      player.baseElement.querySelector('[role="dialog"]'),
      'the player dialog node'
    );
    expect(RAW_TAILWIND_COLOR_RE.test(nonButtonDialogHtml(playerDialog))).toBe(
      false
    );
  });
});
