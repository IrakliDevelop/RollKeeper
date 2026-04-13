'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Loader2 } from 'lucide-react';
import { CharacterExport } from '@/types/character';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { Button, Input } from '@/components/ui/forms';

interface QRShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: string;
  /** Called on open to get the current export snapshot. Avoids stale data. */
  getExportData: () => CharacterExport;
}

type UploadState = 'uploading' | 'ready' | 'error';

export function QRShareDialog({
  open,
  onOpenChange,
  characterId,
  getExportData,
}: QRShareDialogProps) {
  const [uploadState, setUploadState] = useState<UploadState>('uploading');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const doUpload = async () => {
    setUploadState('uploading');
    try {
      const exportData = getExportData();
      const res = await fetch('/api/character/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, character: exportData }),
      });
      if (!res.ok) throw new Error('Upload failed');
      setShareUrl(`${window.location.origin}/import/${characterId}`);
      setUploadState('ready');
    } catch {
      setUploadState('error');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (newOpen) doUpload();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Share Character</DialogTitle>
          <DialogDescription>
            Scan the QR code or copy the link — expires in 24 hours
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {uploadState === 'uploading' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={32} className="text-muted animate-spin" />
              <p className="text-muted text-sm">Generating share link...</p>
            </div>
          )}

          {uploadState === 'error' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-body text-sm">
                Failed to generate share link.
              </p>
              <Button variant="secondary" size="sm" onClick={doUpload}>
                Retry
              </Button>
            </div>
          )}

          {uploadState === 'ready' && (
            <div className="flex flex-col items-center gap-4">
              {/* White background ensures QR readability in dark mode */}
              <div className="rounded-lg bg-white p-3">
                <QRCodeSVG value={shareUrl} size={200} />
              </div>
              <div className="flex w-full gap-2">
                <Input value={shareUrl} readOnly className="flex-1 text-sm" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  leftIcon={copied ? <Check size={16} /> : <Copy size={16} />}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
