import {
  createImage,
  createShape,
  TemplateTool,
  type Tool,
  type ToolContext,
  type PointerState,
} from '@fieldnotes/core';
import { cellUnit } from './cellUnit';
import {
  snapTokenCenter,
  TOKEN_ELEMENT_ZINDEX,
  TEMPLATE_ELEMENT_ZINDEX,
} from './tokenSnap';

export const PLAYER_TOKEN_KIND = 'player';

/** Extra top-level keys stamped on player self-placed tokens (Task 2 stamps
 * them) — like CombatantTokenKeys, they survive store/export/sync round-trips. */
export interface PlayerTokenKeys {
  characterId: string;
  tokenKind: typeof PLAYER_TOKEN_KIND;
}

const TOKEN_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#eab308',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

/** Deterministic per-character token color (canvas paint, not themed UI). */
export function tokenColorForId(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TOKEN_COLORS[h % TOKEN_COLORS.length];
}

const TOKEN_RENDER_PX = 128;
const TOKEN_RING_PX = 8;

/**
 * Only http(s) avatars or same-origin root-relative paths (e.g. the
 * /api/bestiary/token route) may become token images: a base64 data-URL
 * avatar would ride along in every sync upsert for the token (huge
 * payloads). Protocol-relative "//host/…" is rejected — that is an
 * external host, not our origin. Root-relative candidates are resolved
 * against a sentinel origin and re-checked, since a prefix check alone is
 * bypassable (WHATWG URL parsing normalizes backslashes to slashes and
 * strips tab/newline for http(s) schemes, so e.g. "/\evil.example/x" or
 * tab/newline-smuggled "//host" forms pass a naive startsWith check but
 * resolve to an external host in <img src> / new URL()).
 */
export function tokenAvatarUrl(avatar: string | undefined): string | null {
  if (!avatar) return null;
  if (/^https?:\/\//.test(avatar)) return avatar;
  if (avatar.startsWith('/')) {
    try {
      const resolved = new URL(avatar, 'http://internal.invalid');
      if (resolved.origin === 'http://internal.invalid') return avatar;
    } catch {
      return null;
    }
  }
  return null;
}

/** Same-origin proxy for S3 URLs so canvas compositing isn't CORS-tainted. */
function proxyUrl(url: string): string {
  if (url.includes('.s3.') && url.includes('.amazonaws.com')) {
    return `/api/assets/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

const circularTokenCache = new Map<string, Promise<string | null>>();

/**
 * Composites the avatar into a circular token (cover-fit, transparent
 * corners, colored ring) and uploads it to S3, returning the hosted URL.
 * Returns null when the image can't be loaded or S3 isn't configured —
 * callers fall back to the square avatar. Cached per character+avatar so
 * repeat placements don't re-upload.
 */
export function buildCircularTokenUrl(
  avatarUrl: string,
  ringColor: string,
  cacheKey: string
): Promise<string | null> {
  const key = `${cacheKey}:${avatarUrl}:${ringColor}`;
  const cached = circularTokenCache.get(key);
  if (cached) return cached;

  const promise = (async (): Promise<string | null> => {
    const img = await new Promise<HTMLImageElement | null>(resolve => {
      const el = new window.Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => resolve(null);
      el.src = proxyUrl(avatarUrl);
    });
    if (!img) return null;

    const size = TOKEN_RENDER_PX;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // circular clip, cover-fit draw, then the ring
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - TOKEN_RING_PX / 2, 0, Math.PI * 2);
    ctx.clip();
    const scale = Math.max(size / img.width, size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - TOKEN_RING_PX / 2, 0, Math.PI * 2);
    ctx.lineWidth = TOKEN_RING_PX;
    ctx.strokeStyle = ringColor;
    ctx.stroke();

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/png')
    );
    if (!blob) return null;

    try {
      const formData = new FormData();
      formData.append('file', blob, `token-${cacheKey}.png`);
      formData.append('assetId', `token-${cacheKey}`);
      const res = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) return null; // S3 not configured — square avatar fallback
      const data = (await res.json()) as { url?: string };
      return data.url ?? null;
    } catch {
      return null;
    }
  })();

  circularTokenCache.set(key, promise);
  return promise;
}

/**
 * Places the player's token — their (circularized) avatar when available,
 * otherwise a colored ellipse. `srcRef` is read at placement time because
 * the canvas keeps the first registered tool instance: the circular token
 * URL resolves asynchronously and lands in the ref, not in a new tool.
 * Placement snaps to the grid and sizes to one cell; the tool then hands
 * off to Select so the next drag moves the token instead of stamping
 * another. Ownership is stamped by the relay.
 */
export class PlayerTokenTool implements Tool {
  readonly name = 'token';

  constructor(
    private readonly color: string,
    private readonly srcRef: { current: string | null },
    /** Read at placement time (canvas keeps the first tool instance). */
    private readonly characterIdRef: { current: string | null }
  ) {}

  onPointerDown(state: PointerState, ctx: ToolContext): void {
    const world = ctx.camera.screenToWorld({ x: state.x, y: state.y });
    const center = snapTokenCenter(world, 1, ctx);
    const size = cellUnit(ctx);
    const src = this.srcRef.current;

    const base = src
      ? createImage({
          position: { x: center.x - size / 2, y: center.y - size / 2 },
          size: { w: size, h: size },
          src,
          layerId: ctx.activeLayerId ?? '',
          zIndex: TOKEN_ELEMENT_ZINDEX,
        })
      : createShape({
          position: { x: center.x - size / 2, y: center.y - size / 2 },
          size: { w: size, h: size },
          shape: 'ellipse',
          fillColor: this.color,
          strokeColor: '#1e293b',
          strokeWidth: 2,
          layerId: ctx.activeLayerId ?? '',
          zIndex: TOKEN_ELEMENT_ZINDEX,
        });

    const characterId = this.characterIdRef.current;
    if (characterId) {
      const stamped: typeof base & PlayerTokenKeys = {
        ...base,
        characterId,
        tokenKind: PLAYER_TOKEN_KIND,
      };
      ctx.store.add(stamped);
    } else {
      ctx.store.add(base);
    }
    ctx.requestRender();
  }

  onPointerMove(): void {}
  onPointerUp(_state: PointerState, ctx: ToolContext): void {
    // One token per activation: hand off to Select so the next drag moves
    // the token rather than placing another.
    ctx.switchTool?.('select');
  }
}

/**
 * TemplateTool that hands off to Select after the drag-to-size gesture ends,
 * so a follow-up drag adjusts/moves instead of stamping another template.
 */
export class PlayerTemplateTool extends TemplateTool {
  onPointerDown(state: PointerState, ctx: ToolContext): void {
    // The base class's createTemplate call has no zIndex option, so a
    // manually drag-sized template lands at the default (0) and can paint
    // under the map image on remote screens — the same tie-break bug
    // documented at tokenSnap.ts's TOKEN_ELEMENT_ZINDEX. Elevate any newly
    // created template element after the base handler runs.
    const existingIds = new Set(ctx.store.getAll().map(el => el.id));
    super.onPointerDown(state, ctx);
    for (const el of ctx.store.getAll()) {
      if (!existingIds.has(el.id) && el.type === 'template') {
        ctx.store.update(el.id, { zIndex: TEMPLATE_ELEMENT_ZINDEX });
      }
    }
  }

  onPointerUp(state: PointerState, ctx: ToolContext): void {
    super.onPointerUp(state, ctx);
    ctx.switchTool?.('select');
  }
}
