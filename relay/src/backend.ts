import type { CanvasElement, ServiceKey } from '@fieldnotes/core';
import type { HubBackend } from '@fieldnotes/sync-server';
import type { LayerRecord, SyncOp } from '@fieldnotes/sync';
import { RedisHubBackend, type RedisHashClient } from '@fieldnotes/sync-redis';
import {
  createFogBackendPlugin,
  FogBackendServiceKey,
  type FogApplyResult,
  type FogBackendService,
  type FogPatchApplyResult,
} from '@fieldnotes/vtt/redis';
import type {
  FogMetaRecord,
  FogSnapshot,
  FogTileRecord,
} from '@fieldnotes/vtt';

/** Minimal Redis surface — node-redis v4 satisfies this directly. */
export interface BackendRedis {
  hGetAll(key: string): Promise<Record<string, string>>;
  hGet(key: string, field: string): Promise<string | null | undefined>;
  hSet(key: string, fieldValues: Record<string, string>): Promise<unknown>;
  hSet(key: string, field: string, value: string): Promise<unknown>;
  hDel(key: string, fields: string[]): Promise<unknown>;
  hDel(key: string, field: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] }
  ): Promise<unknown>;
}

export interface BufferedRedisBackendOptions {
  keyPrefix?: string; // default 'fieldnotes:room:'
  flushIntervalMs?: number; // default 3000
  roomTtlSeconds?: number; // default 172800 (2 days)
  idleEvictMs?: number; // default 21600000 (6 hours)
  /** Retry delay for non-authoritative TTL maintenance. Primarily a test seam. */
  expiryRetryMs?: number; // default 2000
  /** Bounded final persistence attempts before shutdown reports failure. */
  shutdownRetryAttempts?: number; // default 3
}

interface RoomState {
  elements: Map<string, CanvasElement>;
  dirty: Set<string>;
  removed: Set<string>;
  revisions: Map<string, number>;
  revisionClock: number;
  hydrated: boolean;
  hydrating: Promise<void> | null;
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
 * Fog operations are delegated synchronously to a `RedisHubBackend` from
 * `@fieldnotes/sync-redis` — they use its atomic LWW/generation/cap Lua
 * scripts and are never buffered.
 *
 * Idle rooms are evicted opportunistically: whenever a flush runs, rooms with
 * no pending writes whose last access is older than `idleEvictMs` are dropped
 * from memory (they re-hydrate from Redis on next access). A fully idle
 * process performs no sweeps — the Redis TTL still bounds persistence.
 */
export class BufferedRedisBackend implements HubBackend {
  // Fog/layer plugin services address shared atomic Redis state. The relay's
  // locality plugin independently marks buffered core element ops as local.
  readonly sharedAcrossInstances = true;
  private rooms = new Map<string, RoomState>();
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;
  private flushPromise: Promise<void> | null = null;
  private readonly fogBackend: RedisHubBackend;
  private readonly fogService: FogBackendService;
  private pendingExpires = new Set<string>();
  private expiryTimer: NodeJS.Timeout | null = null;
  private stopping = false;

  constructor(
    private redis: BackendRedis,
    private opts: BufferedRedisBackendOptions = {}
  ) {
    const adapter: RedisHashClient = {
      hGetAll: key => redis.hGetAll(key),
      hGet: async (key, field) => (await redis.hGet(key, field)) ?? null,
      hSet: (key: string, field: string, value: string) =>
        redis.hSet(key, field, value),
      hDel: (key: string, field: string) => redis.hDel(key, field),
      del: key => redis.del(key),
      eval: (script, options) => redis.eval(script, options),
    };
    this.fogBackend = new RedisHubBackend(adapter, {
      keyPrefix: opts.keyPrefix ?? 'fieldnotes:room:',
      plugins: [createFogBackendPlugin()],
    });
    const fogService = this.fogBackend.getService(FogBackendServiceKey);
    if (!fogService)
      throw new Error('Fog backend plugin did not register its service');
    this.fogService = {
      snapshot: room => fogService.snapshot(room),
      applyMeta: async (room, record) => {
        const result = await fogService.applyMeta(room, record);
        if (result.accepted) this.refreshRoomTtl(room);
        return result;
      },
      applyTile: async (room, record) => {
        const result = await fogService.applyTile(room, record);
        if (result.accepted) this.refreshRoomTtl(room);
        return result;
      },
      applyPatch: async (room, records) => {
        const result = await fogService.applyPatch(room, records);
        if (result.accepted.length > 0) this.refreshRoomTtl(room);
        return result;
      },
    };
  }

  getService<T>(key: ServiceKey<T>): T | undefined {
    if (key.id === FogBackendServiceKey.id) return this.fogService as T;
    return this.fogBackend.getService(key);
  }

  layerRecords(room: string): Promise<LayerRecord[]> {
    return this.fogBackend.layerRecords(room);
  }

  getLayerRecord(room: string, id: string): Promise<LayerRecord | undefined> {
    return this.fogBackend.getLayerRecord(room, id);
  }

  applyLayerRecord(room: string, record: LayerRecord): Promise<void> {
    return this.fogBackend.applyLayerRecord(room, record).then(() => {
      this.refreshRoomTtl(room);
    });
  }

  private key(room: string): string {
    return (this.opts.keyPrefix ?? 'fieldnotes:room:') + room;
  }

  private fogMetaKey(room: string): string {
    return this.key(room) + ':fog:meta';
  }

  private fogTilesKey(room: string): string {
    return this.key(room) + ':fog:tiles';
  }

  private layersKey(room: string): string {
    return this.key(room) + ':layers';
  }

  private async ensure(room: string): Promise<RoomState> {
    let st = this.rooms.get(room);
    if (!st) {
      st = {
        elements: new Map(),
        dirty: new Set(),
        removed: new Set(),
        revisions: new Map(),
        revisionClock: 0,
        hydrated: false,
        hydrating: null,
        pendingClear: false,
        lastAccess: Date.now(),
      };
      this.rooms.set(room, st);
    }
    st.lastAccess = Date.now();
    if (!st.hydrated && !st.hydrating) {
      const roomState = st;
      roomState.hydrating = (async () => {
        const raw = await this.redis.hGetAll(this.key(room));
        for (const [id, json] of Object.entries(raw)) {
          if (!roomState.elements.has(id) && !roomState.removed.has(id)) {
            try {
              roomState.elements.set(id, JSON.parse(json) as CanvasElement);
            } catch {
              // corrupt entry — skip
            }
          }
        }
        roomState.hydrated = true;
      })().finally(() => {
        roomState.hydrating = null;
      });
    }
    if (st.hydrating) await st.hydrating;
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
      st.revisions.set(op.element.id, ++st.revisionClock);
      st.elements.set(op.element.id, op.element);
      st.dirty.add(op.element.id);
      st.removed.delete(op.element.id);
      this.schedule();
      this.refreshRoomTtl(room);
    } else if (op.kind === 'remove') {
      st.revisions.set(op.id, ++st.revisionClock);
      st.elements.delete(op.id);
      st.dirty.delete(op.id);
      st.removed.add(op.id);
      this.schedule();
      this.refreshRoomTtl(room);
    } else if (op.kind === 'clear') {
      if (this.flushPromise) await this.flushPromise;
      st.elements.clear();
      st.dirty.clear();
      st.removed.clear();
      st.revisions.clear();
      try {
        await this.redis.del(this.key(room));
        st.pendingClear = false;
      } catch (err) {
        st.pendingClear = true;
        this.schedule();
        console.error('[backend] clear failed, will retry:', err);
      }
      // Clearing elements does not disable fog. Keep every surviving room key
      // on the same lifecycle even though the element hash may now be absent.
      this.refreshRoomTtl(room);
    }
  }

  // ── Fog delegation ──────────────────────────────────────────────────

  async fogSnapshot(room: string): Promise<FogSnapshot | undefined> {
    return this.fogService.snapshot(room);
  }

  async applyFogMeta(
    room: string,
    record: FogMetaRecord
  ): Promise<FogApplyResult<FogMetaRecord>> {
    return this.fogService.applyMeta(room, record);
  }

  async applyFogTile(
    room: string,
    record: FogTileRecord
  ): Promise<FogApplyResult<FogTileRecord>> {
    return this.fogService.applyTile(room, record);
  }

  async applyFogPatch(
    room: string,
    records: readonly FogTileRecord[]
  ): Promise<FogPatchApplyResult> {
    return this.fogService.applyPatch(room, records);
  }

  // ── TTL maintenance ─────────────────────────────────────────────────

  private refreshRoomTtl(room: string): void {
    this.pendingExpires.add(room);
    if (this.expiryTimer) return;
    this.expiryTimer = setTimeout(() => {
      this.expiryTimer = null;
      void this.flushExpires();
    }, 500);
  }

  private async flushExpires(): Promise<void> {
    const rooms = [...this.pendingExpires];
    this.pendingExpires.clear();
    const ttl = this.opts.roomTtlSeconds ?? 172800;
    for (const room of rooms) {
      try {
        await Promise.all([
          this.redis.expire(this.key(room), ttl),
          this.redis.expire(this.fogMetaKey(room), ttl),
          this.redis.expire(this.fogTilesKey(room), ttl),
          this.redis.expire(this.layersKey(room), ttl),
        ]);
      } catch (err) {
        this.pendingExpires.add(room);
        if (!this.stopping && !this.expiryTimer) {
          this.expiryTimer = setTimeout(() => {
            this.expiryTimer = null;
            void this.flushExpires();
          }, this.opts.expiryRetryMs ?? 2000);
        }
        console.error('[backend] TTL refresh failed, will retry:', err);
      }
    }
  }

  // ── Element flush ───────────────────────────────────────────────────

  private schedule(): void {
    if (this.timer || this.stopping) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.opts.flushIntervalMs ?? 3000);
  }

  async flush(): Promise<void> {
    if (this.flushing) {
      this.schedule();
      return;
    }
    this.flushing = true;
    let resolveFlush!: () => void;
    this.flushPromise = new Promise<void>(res => {
      resolveFlush = res;
    });
    try {
      for (const [room, st] of this.rooms) {
        const key = this.key(room);
        if (st.pendingClear) {
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
        const setRevisions = new Map<string, number>();
        for (const id of st.dirty) {
          const el = st.elements.get(id);
          if (el) {
            toSet[id] = JSON.stringify(el);
            setRevisions.set(id, st.revisions.get(id) ?? 0);
          }
        }
        const toDel = [...st.removed];
        const delRevisions = new Map(
          toDel.map(id => [id, st.revisions.get(id) ?? 0] as const)
        );
        st.dirty.clear();
        st.removed.clear();
        try {
          if (Object.keys(toSet).length > 0) await this.redis.hSet(key, toSet);
          if (toDel.length > 0) await this.redis.hDel(key, toDel);
          await this.redis.expire(key, this.opts.roomTtlSeconds ?? 172800);
        } catch (err) {
          for (const id of Object.keys(toSet)) {
            if (
              st.revisions.get(id) === setRevisions.get(id) &&
              st.elements.has(id)
            ) {
              st.dirty.add(id);
            }
          }
          for (const id of toDel) {
            if (
              st.revisions.get(id) === delRevisions.get(id) &&
              !st.elements.has(id)
            ) {
              st.removed.add(id);
            }
          }
          this.schedule();
          console.error('[backend] flush failed, will retry:', err);
        }
      }
      this.evictIdleRooms();
    } finally {
      this.flushing = false;
      resolveFlush();
      this.flushPromise = null;
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
    this.stopping = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
    if (this.flushPromise) await this.flushPromise;
    const attempts = Math.max(1, this.opts.shutdownRetryAttempts ?? 3);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await this.flush();
      const pendingWrites = [...this.rooms.values()].some(
        st => st.pendingClear || st.dirty.size > 0 || st.removed.size > 0
      );
      if (!pendingWrites) break;
      if (attempt === attempts - 1) {
        throw new Error('Redis writes remain pending after shutdown retries');
      }
      await new Promise(resolve =>
        setTimeout(resolve, this.opts.expiryRetryMs ?? 2000)
      );
    }
    // TTL refreshes are lifecycle maintenance rather than part of accepting a
    // fog write. During shutdown, however, do not abandon a transient failure:
    // drain the queue before the Redis connection is closed by the caller.
    for (let attempt = 0; this.pendingExpires.size > 0; attempt += 1) {
      await this.flushExpires();
      if (this.pendingExpires.size > 0 && attempt >= attempts - 1) {
        throw new Error(
          'Redis TTL refreshes remain pending after shutdown retries'
        );
      }
      if (this.pendingExpires.size > 0) {
        await new Promise(resolve =>
          setTimeout(resolve, this.opts.expiryRetryMs ?? 2000)
        );
      }
    }
  }
}
