import type {
  AuthorityCommitContext,
  AuthorityCommitRequest,
  AuthorityIntent,
} from '@fieldnotes/sync-server';
import { prepareFogAuthorityIntent } from '@fieldnotes/vtt/server';

type ValidatedIntent = AuthorityIntent & { readonly expectedState?: string };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function exactKeys(value: unknown, keys: readonly string[]): boolean {
  const object = record(value);
  if (!object) return false;
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonical(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function equal(left: unknown, right: unknown): boolean {
  return canonical(left) === canonical(right);
}

function withoutOwner(value: unknown): Record<string, unknown> | null {
  const object = record(value);
  if (!object) return null;
  const safe = { ...object };
  delete safe.ownerId;
  return safe;
}

/** Rejects every proposal/intent mismatch before the driver is allowed to touch Redis. */
export function validateAuthorityRequest(
  context: AuthorityCommitContext,
  request: AuthorityCommitRequest
): ValidatedIntent | null {
  const proposal = record(request.proposal);
  const intent = record(request.intent);
  if (!proposal || !intent || proposal.kind !== 'propose') return null;
  const mutation = record(proposal.mutation);
  if (!mutation || proposal.generation !== context.roomGeneration) return null;
  const proposalKeys =
    mutation.kind === 'clear'
      ? [
          'protocol',
          'kind',
          'generation',
          'clientOperationId',
          'mutation',
          'expectedState',
        ]
      : ['protocol', 'kind', 'generation', 'clientOperationId', 'mutation'];
  if (
    !exactKeys(proposal, proposalKeys) ||
    proposal.protocol !== 'authority:1' ||
    proposal.clientOperationId !== context.clientOperationId
  )
    return null;

  if (mutation.kind === 'upsert') {
    if (
      !exactKeys(mutation, ['kind', 'element']) ||
      !exactKeys(intent, ['schema', 'kind', 'element'])
    )
      return null;
    const element = withoutOwner(mutation.element);
    if (
      !element ||
      intent.schema !== 1 ||
      intent.kind !== 'element-upsert' ||
      !equal(element, intent.element)
    )
      return null;
    return request.intent;
  }
  if (mutation.kind === 'remove') {
    if (
      !exactKeys(mutation, ['kind', 'id']) ||
      !exactKeys(intent, ['schema', 'kind', 'id'])
    )
      return null;
    return intent.schema === 1 &&
      intent.kind === 'element-remove' &&
      mutation.id === intent.id
      ? request.intent
      : null;
  }
  if (mutation.kind === 'clear') {
    if (
      !exactKeys(mutation, ['kind']) ||
      !exactKeys(intent, ['schema', 'kind'])
    )
      return null;
    const expectedState = proposal.expectedState;
    if (
      intent.schema !== 1 ||
      intent.kind !== 'elements-clear' ||
      typeof expectedState !== 'string' ||
      expectedState.length === 0
    )
      return null;
    return { ...request.intent, expectedState };
  }
  if (mutation.kind === 'layer-upsert') {
    if (
      !exactKeys(mutation, ['kind', 'layer', 'version', 'editor']) ||
      !exactKeys(intent, ['schema', 'kind', 'record'])
    )
      return null;
    const expected = {
      id: record(mutation.layer)?.id,
      version: mutation.version,
      editor: mutation.editor,
      definition: mutation.layer,
    };
    return intent.schema === 1 &&
      intent.kind === 'layer-write' &&
      exactKeys(intent.record, ['id', 'version', 'editor', 'definition']) &&
      equal(expected, intent.record)
      ? request.intent
      : null;
  }
  if (mutation.kind === 'layer-remove') {
    if (
      !exactKeys(mutation, ['kind', 'id', 'version', 'editor']) ||
      !exactKeys(intent, ['schema', 'kind', 'record'])
    )
      return null;
    const expected = {
      id: mutation.id,
      version: mutation.version,
      editor: mutation.editor,
    };
    return intent.schema === 1 &&
      intent.kind === 'layer-write' &&
      exactKeys(intent.record, ['id', 'version', 'editor']) &&
      equal(expected, intent.record)
      ? request.intent
      : null;
  }
  if (mutation.kind === 'fog-meta' || mutation.kind === 'fog-patch') {
    const mutationKeys =
      mutation.kind === 'fog-meta'
        ? ['kind', 'record']
        : ['kind', 'generation', 'tiles'];
    if (
      !exactKeys(mutation, mutationKeys) ||
      !exactKeys(intent, ['schema', 'kind', 'key', 'version', 'payload'])
    )
      return null;
    if (mutation.kind === 'fog-patch') {
      if (
        typeof mutation.generation !== 'string' ||
        !Array.isArray(mutation.tiles) ||
        mutation.tiles.length > 64 ||
        mutation.tiles.some(
          tile => record(tile)?.generation !== mutation.generation
        )
      )
        return null;
    }
    let prepared: ReturnType<typeof prepareFogAuthorityIntent>;
    try {
      prepared = prepareFogAuthorityIntent(proposal.mutation as never);
    } catch {
      return null;
    }
    return prepared &&
      intent.schema === 1 &&
      intent.kind === 'extension' &&
      intent.key === 'fog' &&
      intent.version === 1 &&
      equal(prepared, intent.payload)
      ? request.intent
      : null;
  }
  return null;
}
