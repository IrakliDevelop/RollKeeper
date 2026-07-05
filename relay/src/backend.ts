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
  idleEvictMs?: number; // default 21600000 (6 hours)
}

interface RoomState {
  elements: Map<string, CanvasElement>;
  dirty: Set<string>;
  removed: Set<string>;
  hydrated: boolean;
  /** A clear whose redis DEL failed; must be retried before any writes land. */
  pendingClear: boolean;
  lastAccess: number;
}

/**
 * Memory-first HubBackend: reads never hit Redis after hydration, and writes
 * are batched into one hSet + hDel + expire per room per flush interval.
 * Rationale: Upstash bills per command; the stock sync-redis backend issues
 * 1-2 commands per drag-frame op. Single-instance only (state lives here).
 *
 * Idle rooms are evicted opportunistically: whenever a flush runs, rooms with
 * no pending writes whose last access is older than `idleEvictMs` are dropped
 * from memory (they re-hydrate from Redis on next access). A fully idle
 * process performs no sweeps — the Redis TTL still bounds persistence.
 */
export class BufferedRedisBackend implements HubBackend {
  private rooms = new Map<string, RoomState>();
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;

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
        pendingClear: false,
        lastAccess: Date.now(),
      };
      this.rooms.set(room, st);
    }
    st.lastAccess = Date.now();
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
      try {
        await this.redis.del(this.key(room));
        st.pendingClear = false;
      } catch (err) {
        // memory is already cleared; retry the DEL on the next flush so a
        // stale Redis hash cannot resurrect elements after a restart
        st.pendingClear = true;
        this.schedule();
        console.error('[backend] clear failed, will retry:', err);
      }
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
    if (this.flushing) {
      // a slow flush is still in-flight; don't overlap — try next interval
      this.schedule();
      return;
    }
    this.flushing = true;
    try {
      for (const [room, st] of this.rooms) {
        const key = this.key(room);
        if (st.pendingClear) {
          // the DEL must land before any post-clear writes, otherwise a later
          // successful DEL would wipe them; skip the room until it succeeds
          try {
            await this.redis.del(key);
            st.pendingClear = false;
          } catch (err) {
            this.schedule();
            console.error('[backend] clear retry failed, will retry:', err);
            continue;
          }
        }
        if (st.dirty.size === 0 && st.removed.size === 0) continue;
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
          // put them back and retry on the next flush; the retry rebuilds
          // payloads from live elements, so interim writes are never lost
          for (const id of Object.keys(toSet)) st.dirty.add(id);
          for (const id of toDel) st.removed.add(id);
          this.schedule();
          console.error('[backend] flush failed, will retry:', err);
        }
      }
      this.evictIdleRooms();
    } finally {
      this.flushing = false;
    }
  }

  /** Opportunistic eviction — runs at the end of every flush. */
  private evictIdleRooms(): void {
    const idleMs = this.opts.idleEvictMs ?? 6 * 60 * 60 * 1000;
    const now = Date.now();
    for (const [room, st] of this.rooms) {
      if (st.dirty.size > 0 || st.removed.size > 0 || st.pendingClear) continue;
      if (now - st.lastAccess > idleMs) this.rooms.delete(room);
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
