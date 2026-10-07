import {
  DISPLAY_ACK_SCRIPT,
  DISPLAY_ROTATE_SCRIPT,
  DISPLAY_STATUS_SCRIPT,
  DISPLAY_VERIFY_SCRIPT,
} from '@/lib/tableServer/displayScripts';

import type { TableFakeRedis } from './tableFakeRedis';

type Json = Record<string, unknown>;

/**
 * PR05 route tests: a JavaScript model of the four display Lua scripts over
 * the in-memory table fake (the scripts themselves run against real Redis in
 * `scripts/table-control-redis.integration.test.mjs`). Rotation never bumps
 * control `revision` (R4-F1); ACK/status bind to presentation revision and
 * display generation; the binding is compare-if-unbound (E4).
 */
export function installDisplayEval(fake: TableFakeRedis, clock = Date.now) {
  const parse = (value: string | undefined): Json | null => {
    if (value === undefined) return null;
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Json)
        : null;
    } catch {
      return null;
    }
  };
  const ackExpiry = new Map<string, number>();
  const project = (state: Json, registryKey: string) => {
    const presentation = state.presentation as Json | undefined;
    let sceneId: string | null = null;
    let blanked = false;
    const revision = presentation?.revision;
    if (presentation?.blanked === true) blanked = true;
    else if (typeof presentation?.sceneId === 'string') {
      const entry = parse(
        fake.hashes.get(registryKey)?.get(presentation.sceneId)
      );
      if (
        entry?.v === 1 &&
        entry.deleted !== true &&
        entry.sceneId === presentation.sceneId &&
        typeof entry.sourceMapId === 'string' &&
        entry.sourceMapId.length > 0
      )
        sceneId = presentation.sceneId;
    }
    return { sceneId, blanked, revision };
  };
  const verified = (
    controlKey: string,
    sessionKey: string,
    hash: string,
    nonceHash: string,
    bind: boolean
  ): { status: string; state?: Json; raw?: string } => {
    const raw = fake.strings.get(controlKey);
    if (raw === undefined) return { status: 'expired' };
    const state = parse(raw);
    if (!state || state.v !== 1) return { status: 'unavailable' };
    if (
      typeof state.displayCapabilityHash !== 'string' ||
      state.displayCapabilityHash !== hash ||
      typeof state.displayGeneration !== 'number' ||
      state.displayGeneration < 1
    )
      return { status: 'expired' };
    const binding = parse(fake.strings.get(sessionKey));
    if (binding && binding.displayGeneration === state.displayGeneration) {
      if (binding.nonceHash !== nonceHash) return { status: 'in-use' };
    } else if (bind) {
      fake.strings.set(
        sessionKey,
        JSON.stringify({
          displayGeneration: state.displayGeneration,
          nonceHash,
        })
      );
    } else return { status: 'unbound' };
    return { status: 'ok', state, raw };
  };
  const evaluate = async (
    script: string,
    keys: string[],
    args: string[]
  ): Promise<string> => {
    if (script === DISPLAY_ROTATE_SCRIPT) {
      const [controlKey, sessionKey, ackKey] = keys;
      const state = parse(fake.strings.get(controlKey!));
      if (!state) return JSON.stringify({ status: 'not-initialized' });
      if (state.v !== 1) return JSON.stringify({ status: 'unavailable' });
      const generation = Number(args[1]);
      if (state.displayGeneration === generation)
        return JSON.stringify({ status: 'collision' });
      state.displayGeneration = generation;
      state.displayCapabilityHash = args[0];
      fake.strings.set(controlKey!, JSON.stringify(state));
      fake.strings.delete(sessionKey!);
      fake.strings.delete(ackKey!);
      return JSON.stringify({
        status: 'rotated',
        displayGeneration: generation,
      });
    }
    if (script === DISPLAY_VERIFY_SCRIPT) {
      const [controlKey, sessionKey, registryKey] = keys;
      const result = verified(
        controlKey!,
        sessionKey!,
        args[0]!,
        args[1]!,
        args[2] === '1'
      );
      if (result.status !== 'ok') return JSON.stringify(result);
      const sceneId = (result.state!.presentation as Json | undefined)?.sceneId;
      const entry =
        typeof sceneId === 'string'
          ? (fake.hashes.get(registryKey!)?.get(sceneId) ?? null)
          : null;
      return JSON.stringify({ status: 'ok', control: result.raw, entry });
    }
    if (script === DISPLAY_ACK_SCRIPT) {
      const [controlKey, sessionKey, ackKey, registryKey] = keys;
      const result = verified(
        controlKey!,
        sessionKey!,
        args[0]!,
        args[1]!,
        false
      );
      if (result.status === 'unbound')
        return JSON.stringify({ status: 'stale' });
      if (result.status !== 'ok') return JSON.stringify(result);
      const state = result.state!;
      const ack = JSON.parse(args[2]!) as Json;
      const target = project(state, registryKey!);
      if (
        ack.epoch !== state.epoch ||
        ack.displayGeneration !== state.displayGeneration ||
        ack.presentationRevision !== target.revision ||
        ack.blanked !== target.blanked ||
        ack.sceneId !== target.sceneId ||
        (ack.phase === 'loaded' && target.sceneId === null) ||
        (ack.phase === 'blank' && target.sceneId !== null)
      )
        return JSON.stringify({ status: 'stale' });
      const receivedAt = clock();
      fake.strings.set(
        ackKey!,
        JSON.stringify({
          v: 1,
          displayGeneration: state.displayGeneration,
          epoch: state.epoch,
          presentationRevision: target.revision,
          sceneId: target.sceneId,
          blanked: target.blanked,
          phase: ack.phase,
          receivedAt,
        })
      );
      ackExpiry.set(ackKey!, receivedAt + 30_000);
      return JSON.stringify({ status: 'recorded', receivedAt });
    }
    if (script === DISPLAY_STATUS_SCRIPT) {
      const [controlKey, ackKey, registryKey] = keys;
      const now = clock();
      if ((ackExpiry.get(ackKey!) ?? Infinity) <= now)
        fake.strings.delete(ackKey!);
      const none = JSON.stringify({
        state: 'none',
        sceneId: null,
        ageMs: null,
      });
      const state = parse(fake.strings.get(controlKey!));
      if (!state) return none;
      if (state.v !== 1) return JSON.stringify({ state: 'unavailable' });
      const ack = parse(fake.strings.get(ackKey!));
      if (
        !ack ||
        typeof state.displayGeneration !== 'number' ||
        state.displayGeneration < 1
      )
        return none;
      const ageMs = Math.max(0, now - Number(ack.receivedAt));
      if (ageMs >= 15_000)
        return JSON.stringify({ state: 'stale', sceneId: ack.sceneId, ageMs });
      const target = project(state, registryKey!);
      const matches =
        ack.epoch === state.epoch &&
        ack.displayGeneration === state.displayGeneration &&
        ack.presentationRevision === target.revision &&
        ack.sceneId === target.sceneId &&
        ack.blanked === target.blanked;
      const value = !matches
        ? 'updating'
        : target.blanked
          ? 'blank'
          : target.sceneId !== null && ack.phase === 'loaded'
            ? 'loaded'
            : 'waiting';
      return JSON.stringify({
        state: value,
        sceneId: matches ? target.sceneId : ack.sceneId,
        ageMs,
      });
    }
    throw new Error('unexpected script in display fake');
  };
  Object.assign(fake.rawRedis, { eval: evaluate });
  return evaluate;
}
