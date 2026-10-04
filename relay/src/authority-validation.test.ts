import { describe, expect, it } from 'vitest';
import { createShape } from '@fieldnotes/core';
import { prepareFogAuthorityIntent } from '@fieldnotes/vtt/server';

import { validateAuthorityRequest } from './authority-validation.js';

const context = {
  room: '123e4567-e89b-42d3-a456-426614174000',
  actorId: 'actor-1',
  connectionId: 'connection-1',
  userId: 'dm-1',
  role: 'dm',
  ownershipId: 'dm-1',
  definitionId: 'table-v1',
  roomGeneration: 'generation-1',
  clientOperationId: 'operation-1',
  operationDigest: 'digest-1',
  deadlineAt: Date.now() + 5_000,
  signal: new AbortController().signal,
} as const;

function request(
  proposalMutation: unknown,
  intent: unknown,
  proposalExtra: Record<string, unknown> = {}
) {
  return {
    proposal: {
      protocol: 'authority:1',
      kind: 'propose',
      generation: 'generation-1',
      clientOperationId: 'operation-1',
      mutation: proposalMutation,
      ...proposalExtra,
    },
    intent,
  } as never;
}

const element = {
  ...createShape({ position: { x: 1, y: 2 }, size: { w: 10, h: 10 } }),
  id: 'element-1',
};
const layer = {
  id: 'layer-1',
  name: 'Layer 1',
  visible: true,
  locked: false,
  order: 1,
  opacity: 1,
};
const fogDefinition = {
  version: 1,
  base: 'covered' as const,
  bounds: { x: 0, y: 0, w: 1024, h: 1024 },
  cellSize: 1,
  tileCells: 128 as const,
  generation: 'fog-generation-1',
};
const fogMetaMutation = {
  kind: 'fog-meta' as const,
  record: { version: 1, editor: 'dm-1', definition: fogDefinition },
};
const fogPatchMutation = {
  kind: 'fog-patch' as const,
  generation: 'fog-generation-1',
  tiles: [
    {
      generation: 'fog-generation-1',
      x: 0,
      y: 0,
      version: 1,
      editor: 'dm-1',
    },
  ],
};

const validPairs = [
  {
    label: 'element create/edit',
    mutation: { kind: 'upsert', element },
    intent: { schema: 1, kind: 'element-upsert', element },
  },
  {
    label: 'element remove',
    mutation: { kind: 'remove', id: element.id },
    intent: { schema: 1, kind: 'element-remove', id: element.id },
  },
  {
    label: 'elements clear',
    mutation: { kind: 'clear' },
    intent: { schema: 1, kind: 'elements-clear' },
    proposalExtra: { expectedState: 'cas-current' },
  },
  {
    label: 'layer upsert',
    mutation: {
      kind: 'layer-upsert',
      layer,
      version: 1,
      editor: 'dm-1',
    },
    intent: {
      schema: 1,
      kind: 'layer-write',
      record: { id: layer.id, version: 1, editor: 'dm-1', definition: layer },
    },
  },
  {
    label: 'layer tombstone',
    mutation: {
      kind: 'layer-remove',
      id: layer.id,
      version: 2,
      editor: 'dm-1',
    },
    intent: {
      schema: 1,
      kind: 'layer-write',
      record: { id: layer.id, version: 2, editor: 'dm-1' },
    },
  },
  {
    label: 'fog meta',
    mutation: fogMetaMutation,
    intent: {
      schema: 1,
      kind: 'extension',
      key: 'fog',
      version: 1,
      payload: prepareFogAuthorityIntent(fogMetaMutation),
    },
  },
  {
    label: 'fog patch',
    mutation: fogPatchMutation,
    intent: {
      schema: 1,
      kind: 'extension',
      key: 'fog',
      version: 1,
      payload: prepareFogAuthorityIntent(fogPatchMutation),
    },
  },
] as const;

describe('authority proposal/intent correspondence', () => {
  it('accepts only the exact upsert pair while discarding proposal ownerId', () => {
    const element = {
      id: 'element-1',
      type: 'shape',
      x: 1,
      y: 2,
      ownerId: 'forged-owner',
    };
    const result = validateAuthorityRequest(
      context,
      request(
        { kind: 'upsert', element },
        {
          schema: 1,
          kind: 'element-upsert',
          element: { id: 'element-1', type: 'shape', x: 1, y: 2 },
        }
      )
    );
    expect(result?.kind).toBe('element-upsert');
    expect(
      result && 'element' in result ? result.element : null
    ).not.toHaveProperty('ownerId');
  });

  it.each(validPairs)('accepts the exact $label pair', pair => {
    expect(
      validateAuthorityRequest(
        context,
        request(pair.mutation, pair.intent, pair.proposalExtra ?? {})
      )
    ).toEqual(expect.objectContaining({ kind: pair.intent.kind }));
  });

  it('rejects every proposal discriminant crossed with every wrong intent family', () => {
    for (
      let proposalIndex = 0;
      proposalIndex < validPairs.length;
      proposalIndex += 1
    ) {
      const proposal = validPairs[proposalIndex]!;
      for (
        let intentIndex = 0;
        intentIndex < validPairs.length;
        intentIndex += 1
      ) {
        if (proposalIndex === intentIndex) continue;
        const intent = validPairs[intentIndex]!;
        expect(
          validateAuthorityRequest(
            context,
            request(
              proposal.mutation,
              intent.intent,
              proposal.proposalExtra ?? {}
            )
          ),
          `${proposal.label} crossed with ${intent.label}`
        ).toBeNull();
      }
    }
  });

  it.each([
    ['foreign extension key', { ...validPairs[5]!.intent, key: 'other' }],
    ['foreign extension version', { ...validPairs[5]!.intent, version: 2 }],
    ['extra extension field', { ...validPairs[5]!.intent, extra: true }],
  ])('rejects %s', (_label, intent) => {
    expect(
      validateAuthorityRequest(context, request(fogMetaMutation, intent))
    ).toBeNull();
  });

  it.each([
    ['missing', {}],
    ['empty', { expectedState: '' }],
    ['non-string', { expectedState: 1 }],
    ['wrong token location', { expectedState: undefined }],
  ])('rejects clear expectedState substitution: %s', (_label, extra) => {
    expect(
      validateAuthorityRequest(
        context,
        request({ kind: 'clear' }, { schema: 1, kind: 'elements-clear' }, extra)
      )
    ).toBeNull();
  });

  it('rejects malformed tombstones and fog generation/cap violations', () => {
    expect(
      validateAuthorityRequest(
        context,
        request(validPairs[4]!.mutation, {
          ...validPairs[4]!.intent,
          record: { ...validPairs[4]!.intent.record, definition: null },
        })
      )
    ).toBeNull();
    const wrongGeneration = {
      ...fogPatchMutation,
      tiles: [{ ...fogPatchMutation.tiles[0], generation: 'other' }],
    };
    expect(
      validateAuthorityRequest(
        context,
        request(wrongGeneration, {
          ...validPairs[6]!.intent,
          payload: prepareFogAuthorityIntent(wrongGeneration),
        })
      )
    ).toBeNull();
    const tooMany = {
      ...fogPatchMutation,
      tiles: Array.from({ length: 65 }, (_, index) => ({
        ...fogPatchMutation.tiles[0],
        x: index,
      })),
    };
    expect(
      validateAuthorityRequest(
        context,
        request(tooMany, {
          ...validPairs[6]!.intent,
          payload: {
            schema: 1,
            kind: 'patch',
            generation: 'fog-generation-1',
            tiles: tooMany.tiles,
          },
        })
      )
    ).toBeNull();
  });

  it.each([
    [
      'crossed element pair',
      { kind: 'remove', id: 'element-1' },
      { schema: 1, kind: 'elements-clear' },
    ],
    [
      'extra proposal key',
      { kind: 'remove', id: 'element-1', extra: true },
      { schema: 1, kind: 'element-remove', id: 'element-1' },
    ],
    [
      'extra intent key',
      { kind: 'remove', id: 'element-1' },
      { schema: 1, kind: 'element-remove', id: 'element-1', extra: true },
    ],
    [
      'proposal extension',
      { kind: 'extension', key: 'fog', version: 1, payload: {} },
      { schema: 1, kind: 'extension', key: 'fog', version: 1, payload: {} },
    ],
    [
      'layer tombstone definition',
      { kind: 'layer-remove', id: 'layer-1', version: 1, editor: 'dm' },
      {
        schema: 1,
        kind: 'layer-write',
        record: { id: 'layer-1', version: 1, editor: 'dm', definition: null },
      },
    ],
    [
      'clear without expected state',
      { kind: 'clear' },
      { schema: 1, kind: 'elements-clear' },
    ],
  ])('rejects %s before Redis', (_label, proposal, intent) => {
    expect(
      validateAuthorityRequest(context, request(proposal, intent))
    ).toBeNull();
  });
});
