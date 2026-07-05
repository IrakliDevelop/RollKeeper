import type { CanvasElement } from '@fieldnotes/core';
import type { HubBackend } from '@fieldnotes/sync-server';
import type { SyncOp } from '@fieldnotes/sync';

/** Minimal Redis surface — node-redis v4 satisfies this directly. */
export interface BackendRedis {
  hGetAll(key: string): Promise<Record<string, string>>;
  hSet(key: string, fieldValues: Record<string, string>): Promise<unknown>;
  hDel(key: string, fields: string[]): Promise<unknown>;
  del(key: string): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
}

export interface BufferedRedisBackendOptions {
  keyPrefix?: string; // default 'fieldnotes:room:'
  flushIntervalMs?: number; // default 3000
  roomTtlSeconds?: number; // default 172800 (2 days)
}

interface RoomState {
  elements: Map<string, CanvasElement>;
  dirty: Set<string>;
  removed: Set<string>;
  hydrated: boolean;
}

/**
 * Memory-first HubBackend: reads never hit Redis after hydration, and writes
 * are batched into one hSet + hDel + expire per room per flush interval.
 * Rationale: Upstash bills per command; the stock sync-redis backend issues
 * 1-2 commands per drag-frame op. Single-instance only (state lives here).
 */
export class BufferedRedisBackend implements HubBackend {
  private rooms = new Map<string, RoomState>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private redis: BackendRedis,
    private opts: BufferedRedisBackendOptions = {}
  ) {}

  private key(room: string): string {
    return (this.opts.keyPrefix ?? 'fieldnotes:room:') + room;
  }

  private async ensure(room: string): Promise<RoomState> {
    let st = this.rooms.get(room);
    if (!st) {
      st = {
        elements: new Map(),
        dirty: new Set(),
        removed: new Set(),
        hydrated: false,
      };
      this.rooms.set(room, st);
    }
    if (!st.hydrated) {
      st.hydrated = true; // set first so concurrent callers don't double-hydrate
      const raw = await this.redis.hGetAll(this.key(room));
      for (const [id, json] of Object.entries(raw)) {
        if (!st.elements.has(id) && !st.removed.has(id)) {
          try {
            st.elements.set(id, JSON.parse(json) as CanvasElement);
          } catch {
            // corrupt entry — skip
          }
        }
      }
    }
    return st;
  }

  async snapshot(room: string): Promise<CanvasElement[]> {
    const st = await this.ensure(room);
    return [...st.elements.values()];
  }

  async get(room: string, id: string): Promise<CanvasElement | undefined> {
    const st = await this.ensure(room);
    return st.elements.get(id);
  }

  async apply(room: string, op: SyncOp): Promise<void> {
    const st = await this.ensure(room);
    if (op.kind === 'upsert') {
      st.elements.set(op.element.id, op.element);
      st.dirty.add(op.element.id);
      st.removed.delete(op.element.id);
      this.schedule();
    } else if (op.kind === 'remove') {
      st.elements.delete(op.id);
      st.dirty.delete(op.id);
      st.removed.add(op.id);
      this.schedule();
    } else if (op.kind === 'clear') {
      st.elements.clear();
      st.dirty.clear();
      st.removed.clear();
      await this.redis.del(this.key(room));
    }
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.opts.flushIntervalMs ?? 3000);
  }

  async flush(): Promise<void> {
    for (const [room, st] of this.rooms) {
      if (st.dirty.size === 0 && st.removed.size === 0) continue;
      const key = this.key(room);
      const toSet: Record<string, string> = {};
      for (const id of st.dirty) {
        const el = st.elements.get(id);
        if (el) toSet[id] = JSON.stringify(el);
      }
      const toDel = [...st.removed];
      st.dirty.clear();
      st.removed.clear();
      try {
        if (Object.keys(toSet).length > 0) await this.redis.hSet(key, toSet);
        if (toDel.length > 0) await this.redis.hDel(key, toDel);
        await this.redis.expire(key, this.opts.roomTtlSeconds ?? 172800);
      } catch (err) {
        // put them back and retry on the next flush
        for (const id of Object.keys(toSet)) st.dirty.add(id);
        for (const id of toDel) st.removed.add(id);
        this.schedule();
        console.error('[backend] flush failed, will retry:', err);
      }
    }
  }

  async stopAndFlush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.flush();
  }
}
