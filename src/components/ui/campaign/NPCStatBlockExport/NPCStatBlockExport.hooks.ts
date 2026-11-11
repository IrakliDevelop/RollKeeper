import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { toPng } from 'html-to-image';

import { exportFileName, toDataUrl } from './NPCStatBlockExport.utils';

import type { CampaignNPC } from '@/types/encounter';

export type ExportStatus = 'idle' | 'copying' | 'copied' | 'downloading';
export type ExportError = 'copy' | 'save' | null;

const COPIED_RESET_MS = 2000;

/** The NPC portrait as a data URL, so the capture can draw it. */
function useAvatarDataUrl(avatarUrl: string | undefined): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    setDataUrl(null);
    if (!avatarUrl) return;
    let cancelled = false;
    toDataUrl(avatarUrl).then(d => {
      if (!cancelled) setDataUrl(d);
    });
    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  return dataUrl;
}

/** html-to-image clones the DOM and inlines getComputedStyle() on every child.
 *  A visibility:hidden container would bake `hidden` into every clone, so the
 *  container is made visible behind everything while it is captured. */
async function captureElement(el: HTMLElement): Promise<Blob> {
  const prev = {
    visibility: el.style.visibility,
    position: el.style.position,
    left: el.style.left,
    top: el.style.top,
    zIndex: el.style.zIndex,
  };
  el.style.visibility = 'visible';
  el.style.position = 'fixed';
  el.style.left = '0';
  el.style.top = '0';
  el.style.zIndex = '-1';

  try {
    const dataUrl = await toPng(el, { pixelRatio: 2 });
    const res = await fetch(dataUrl);
    return await res.blob();
  } finally {
    el.style.visibility = prev.visibility;
    el.style.position = prev.position;
    el.style.left = prev.left;
    el.style.top = prev.top;
    el.style.zIndex = prev.zIndex;
  }
}

export function useStatBlockExport(
  npc: CampaignNPC,
  containerRef: RefObject<HTMLDivElement | null>
) {
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [error, setError] = useState<ExportError>(null);
  const [canCopy, setCanCopy] = useState(false);
  const avatarDataUrl = useAvatarDataUrl(npc.avatarUrl);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const clearResetTimer = useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = null;
  }, []);

  // Decided after mount so the server render and first client render match.
  useEffect(() => {
    setCanCopy(
      typeof ClipboardItem !== 'undefined' &&
        typeof navigator.clipboard?.write === 'function'
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearResetTimer();
    };
  }, [clearResetTimer]);

  const capture = useCallback(async (): Promise<Blob> => {
    const el = containerRef.current;
    if (!el) throw new Error('Stat block image is not rendered');
    return captureElement(el);
  }, [containerRef]);

  const begin = useCallback(
    (next: ExportStatus) => {
      clearResetTimer();
      setError(null);
      setStatus(next);
    },
    [clearResetTimer]
  );

  const fail = useCallback(
    (kind: 'copy' | 'save', label: string, err: unknown) => {
      console.error(label, err);
      if (!mounted.current) return;
      setError(kind);
      setStatus('idle');
    },
    []
  );

  const copy = useCallback(async () => {
    begin('copying');
    try {
      const blob = await capture();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      if (!mounted.current) return;
      setStatus('copied');
      resetTimer.current = setTimeout(() => {
        resetTimer.current = null;
        setStatus('idle');
      }, COPIED_RESET_MS);
    } catch (err) {
      fail('copy', 'Failed to copy stat block image:', err);
    }
  }, [begin, capture, fail]);

  const download = useCallback(async () => {
    begin('downloading');
    try {
      const blob = await capture();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFileName(npc.name);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (mounted.current) setStatus('idle');
    } catch (err) {
      fail('save', 'Failed to download stat block image:', err);
    }
  }, [begin, capture, fail, npc.name]);

  return { status, error, canCopy, avatarDataUrl, copy, download };
}
