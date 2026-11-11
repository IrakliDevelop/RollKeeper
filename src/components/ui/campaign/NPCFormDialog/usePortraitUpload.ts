import { useCallback, useRef, useState } from 'react';

/** Mirrors the limit in src/app/api/npc/upload/route.ts. */
export const MAX_PORTRAIT_SIZE_MB = 5;

export type PortraitError = 'type' | 'size' | 'upload';

interface UsePortraitUploadArgs {
  /** The saved NPC's id; undefined while creating a new one. */
  npcId: string | undefined;
  onChange: (url: string) => void;
}

// Regional upload URLs (s3Upload.ts:59) don't match this check, as in every other
// upload control; kept for parity pending the owner's decision on real S3 deletes.
function deleteFromS3(url: string) {
  if (!url.includes('s3.amazonaws.com')) return;
  fetch(`/api/npc/delete?url=${encodeURIComponent(url)}`, {
    method: 'DELETE',
  }).catch(() => {});
}

/**
 * Portrait upload for the NPC form. It never deletes the original portrait:
 * only files uploaded during this session are deleted, on commit (all but the
 * saved one) or on discardAll (all of them).
 */
export function usePortraitUpload({ npcId, onChange }: UsePortraitUploadArgs) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<PortraitError | null>(null);
  const sessionUploads = useRef<string[]>([]);
  // Bumped by commit and discardAll. An upload that resolves under a newer
  // generation belongs to a closed session and must not touch the open one.
  const generation = useRef(0);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith('image/')) {
        setError('type');
        return;
      }
      if (file.size > MAX_PORTRAIT_SIZE_MB * 1024 * 1024) {
        setError('size');
        return;
      }

      const startedIn = generation.current;
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('npcId', npcId ?? `new-npc-${Date.now()}`);

        const res = await fetch('/api/npc/upload', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        const { url } = (await res.json()) as { url: string };

        if (generation.current !== startedIn) {
          deleteFromS3(url);
          return;
        }
        sessionUploads.current.push(url);
        onChange(url);
      } catch {
        if (generation.current === startedIn) setError('upload');
      } finally {
        if (generation.current === startedIn) setUploading(false);
      }
    },
    [npcId, onChange]
  );

  const remove = useCallback(() => {
    onChange('');
  }, [onChange]);

  const commit = useCallback((savedUrl: string) => {
    for (const url of sessionUploads.current) {
      if (url !== savedUrl) deleteFromS3(url);
    }
    sessionUploads.current = [];
    generation.current += 1;
    setError(null);
    setUploading(false);
  }, []);

  const discardAll = useCallback(() => {
    for (const url of sessionUploads.current) deleteFromS3(url);
    sessionUploads.current = [];
    generation.current += 1;
    setError(null);
    setUploading(false);
  }, []);

  return { uploading, error, upload, remove, commit, discardAll };
}
