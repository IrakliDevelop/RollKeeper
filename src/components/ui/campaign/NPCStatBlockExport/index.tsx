'use client';

import { useRef } from 'react';
import { Camera, Check, Download } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { StatBlockImage } from './StatBlockImage';
import { useStatBlockExport } from './NPCStatBlockExport.hooks';

import type { CampaignNPC } from '@/types/encounter';

const ERROR_COPY = {
  copy: "Couldn't copy the image. Download it instead.",
  save: "The image wasn't saved. Try again.",
} as const;

export function NPCStatBlockExport({ npc }: { npc: CampaignNPC }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { status, error, canCopy, avatarDataUrl, copy, download } =
    useStatBlockExport(npc, containerRef);

  if (!npc.monsterStatBlock) return null;

  const busy = status === 'copying' || status === 'downloading';

  return (
    <>
      {/* Hidden offscreen render container: inline styles only */}
      <div
        ref={containerRef}
        aria-hidden
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          width: '900px',
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <StatBlockImage npc={npc} avatarDataUrl={avatarDataUrl} />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap gap-2">
          {canCopy && (
            <Button
              variant="secondary"
              size="sm"
              onClick={copy}
              disabled={busy}
              loading={status === 'copying'}
              leftIcon={
                status === 'copied' ? (
                  <Check size={16} aria-hidden />
                ) : (
                  <Camera size={16} aria-hidden />
                )
              }
            >
              {status === 'copied' ? 'Image copied' : 'Copy image'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={download}
            disabled={busy}
            loading={status === 'downloading'}
            leftIcon={<Download size={16} aria-hidden />}
          >
            Download image
          </Button>
        </div>
        {error && (
          <p role="alert" className="type-small text-blood-text">
            {ERROR_COPY[error]}
          </p>
        )}
      </div>
    </>
  );
}
